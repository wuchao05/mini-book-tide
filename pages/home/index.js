const {
  ensureBookData,
  getAllBills,
  getCurrentMonthKey,
  getSummary,
  formatAmount,
  formatMonthText,
  createDisplayBill,
} = require("../../utils/bill");
const { getCurrentMiniAppProfile } = require("../../utils/runtime-miniapp");
const passcodeAuth = require("../../utils/book-detail/passcode-auth");
const passcodeEntry = require("../../utils/book-detail/passcode-entry");

const PASSCODE_AUTO_FOCUS_DELAY = 520;
const PASSCODE_REFOCUS_DELAY = 120;
const PASSCODE_BLUR_RETRY_DELAY = 80;
const PASSCODE_FOCUS_GUARD_MS = 900;
const MAX_PASSCODE_FAILURE_COUNT = 3;

Page({
  data: {
    appName: "",
    monthLabel: "",
    monthBillCount: 0,
    summary: {
      income: "0.00",
      expense: "0.00",
      balance: "0.00",
    },
    filter: "all",
    filterTabs: [
      { label: "全部", value: "all" },
      { label: "收入", value: "income" },
      { label: "支出", value: "expense" },
    ],
    recentBills: [],
    recentHint: "最近 0 条",
    passcodeDialogVisible: false,
    passcodeValue: "",
    passcodeDigits: ["", "", ""],
    passcodeActiveIndex: 0,
    passcodeInputFocus: false,
    passcodeError: "",
    passcodeSubmitting: false,
  },

  onShow() {
    this.loadMiniAppProfile();
    this.loadPageData();
    this.syncPasscodePrompt();
  },

  onHide() {
    this.clearPasscodeFocusTimer();
  },

  onUnload() {
    this.clearPasscodeFocusTimer();
  },

  syncPasscodePrompt() {
    const promptState = passcodeAuth.consumePrompt();
    if (!promptState) {
      return;
    }

    if (passcodeAuth.isPromptBlocked()) {
      this.hidePasscodeDialog();
      return;
    }

    this.clearPasscodeFocusTimer();
    this.setData({
      passcodeDialogVisible: true,
      passcodeValue: "",
      passcodeDigits: ["", "", ""],
      passcodeActiveIndex: 0,
      passcodeInputFocus: false,
      passcodeError: promptState.message || "",
    });
    this.schedulePasscodeFocus();
  },

  loadMiniAppProfile() {
    const profile = getCurrentMiniAppProfile();
    const appName = (profile && profile.appName) || "账本";

    this.setData({
      appName,
    });
    wx.setNavigationBarTitle({
      title: appName,
    });
  },

  loadPageData() {
    ensureBookData();
    const bills = getAllBills();
    const currentMonthKey = getCurrentMonthKey();
    const monthBills = bills.filter(function (item) {
      return String(item.date || "").slice(0, 7) === currentMonthKey;
    });
    const monthSummary = getSummary(monthBills);

    this.allBills = bills;
    this.setData({
      monthLabel: formatMonthText(currentMonthKey),
      monthBillCount: monthBills.length,
      summary: {
        income: formatAmount(monthSummary.income),
        expense: formatAmount(monthSummary.expense),
        balance: formatAmount(monthSummary.balance),
      },
    });

    this.applyFilter(this.data.filter);
  },

  handleFilterChange(event) {
    this.applyFilter(event.currentTarget.dataset.filter);
  },

  applyFilter(filter) {
    const matchedBills = (this.allBills || []).filter(function (item) {
      return filter === "all" ? true : item.type === filter;
    });

    this.setData({
      filter,
      recentBills: matchedBills.slice(0, 6).map(function (item) {
        return createDisplayBill(item);
      }),
      recentHint: matchedBills.length
        ? "最近 " + matchedBills.length + " 条"
        : "暂无记录",
    });
  },

  goToDetail(event) {
    const id = event.currentTarget.dataset.id;
    wx.navigateTo({
      url: "/pages/bill-detail/index?id=" + id,
    });
  },

  noop() {},

  hidePasscodeDialog() {
    this.clearPasscodeFocusTimer();
    this.passcodeFocusGuardUntil = 0;
    this.passcodeFocusRetryCount = 0;
    this.setData({
      passcodeDialogVisible: false,
      passcodeValue: "",
      passcodeDigits: ["", "", ""],
      passcodeActiveIndex: 0,
      passcodeInputFocus: false,
      passcodeError: "",
      passcodeSubmitting: false,
    });
  },

  clearPasscodeFocusTimer() {
    if (this.passcodeFocusTimer) {
      clearTimeout(this.passcodeFocusTimer);
      this.passcodeFocusTimer = null;
    }
  },

  schedulePasscodeFocus(delay) {
    this.clearPasscodeFocusTimer();
    this.passcodeFocusRetryCount = 0;
    const focusDelay =
      typeof delay === "number" ? delay : PASSCODE_AUTO_FOCUS_DELAY;
    const runFocus = () => {
      this.passcodeFocusTimer = setTimeout(() => {
        this.passcodeFocusTimer = null;
        if (!this.data.passcodeDialogVisible || this.data.passcodeSubmitting) {
          return;
        }
        this.passcodeFocusGuardUntil = Date.now() + PASSCODE_FOCUS_GUARD_MS;
        this.setData({
          passcodeInputFocus: true,
        });
      }, focusDelay);
    };

    if (wx.nextTick) {
      wx.nextTick(runFocus);
      return;
    }
    runFocus();
  },

  retryPasscodeFocusAfterBlur() {
    this.clearPasscodeFocusTimer();
    this.passcodeFocusRetryCount = (this.passcodeFocusRetryCount || 0) + 1;
    this.passcodeFocusTimer = setTimeout(() => {
      this.passcodeFocusTimer = null;
      if (!this.data.passcodeDialogVisible || this.data.passcodeSubmitting) {
        return;
      }
      this.passcodeFocusGuardUntil = Date.now() + PASSCODE_FOCUS_GUARD_MS;
      this.setData({
        passcodeInputFocus: true,
      });
    }, PASSCODE_BLUR_RETRY_DELAY);
  },

  focusPasscodeInput() {
    if (this.data.passcodeSubmitting) {
      return;
    }

    this.clearPasscodeFocusTimer();
    this.passcodeFocusRetryCount = 0;
    this.passcodeFocusGuardUntil = Date.now() + PASSCODE_FOCUS_GUARD_MS;
    this.setData({
      passcodeInputFocus: true,
    });
  },

  handlePasscodeBlur() {
    if (!this.data.passcodeDialogVisible || this.data.passcodeSubmitting) {
      return;
    }

    const shouldRetryFocus =
      Date.now() < (this.passcodeFocusGuardUntil || 0) &&
      (this.passcodeFocusRetryCount || 0) < 1;
    this.setData({
      passcodeInputFocus: false,
    }, () => {
      if (shouldRetryFocus) {
        this.retryPasscodeFocusAfterBlur();
      }
    });
  },

  buildPasscodeDigits(passcode) {
    const passcodeDigits = ["", "", ""];
    String(passcode || "")
      .split("")
      .slice(0, 3)
      .forEach(function (char, index) {
        passcodeDigits[index] = char;
      });
    return passcodeDigits;
  },

  handlePasscodeInput(event) {
    if (this.data.passcodeSubmitting) {
      return;
    }

    const passcode = String(event.detail.value || "")
      .replace(/\s+/g, "")
      .slice(0, 3);
    this.setData({
      passcodeValue: passcode,
      passcodeDigits: this.buildPasscodeDigits(passcode),
      passcodeActiveIndex: Math.min(passcode.length, 2),
      passcodeError: "",
    });

    if (passcode.length === 3) {
      this.submitPasscode(passcode);
    }
  },

  async submitPasscode(passcodeText) {
    if (this.data.passcodeSubmitting) {
      return;
    }

    const sourcePasscode =
      typeof passcodeText === "string"
        ? passcodeText
        : this.data.passcodeValue || this.data.passcodeDigits.join("");
    const passcode = String(sourcePasscode || "").trim();
    if (passcode.length < 3) {
      this.setData({
        passcodeError: "请输入口令",
      });
      return;
    }

    this.setData({
      passcodeSubmitting: true,
      passcodeError: "",
    });

    const result = await passcodeAuth.verifyPasscode(passcode);
    if (!result.success) {
      if (result.reason === "network") {
        wx.showToast({
          title: result.message || "网络异常，请稍后重试",
          icon: "none",
        });
      }

      const failureState =
        result.reason === "invalid"
          ? passcodeAuth.recordPasscodeFailure()
          : null;
      if (failureState && failureState.blocked) {
        this.hidePasscodeDialog();
        return;
      }

      const failureHint = failureState
        ? `，剩余 ${MAX_PASSCODE_FAILURE_COUNT - failureState.failureCount} 次`
        : "";
      this.setData(
        {
          passcodeValue: "",
          passcodeDigits: ["", "", ""],
          passcodeActiveIndex: 0,
          passcodeInputFocus: false,
          passcodeError: (result.message || "口令无效") + failureHint,
          passcodeSubmitting: false,
        },
        () => {
          this.schedulePasscodeFocus(PASSCODE_REFOCUS_DELAY);
        },
      );
      return;
    }

    const app = getApp();
    const layoutResult =
      app && app.refreshBShellLayout
        ? await app.refreshBShellLayout({
            force: true,
          })
        : {
            success: false,
          };

    if (!(layoutResult && layoutResult.success)) {
      wx.showToast({
        title: "网络异常，请稍后重试",
        icon: "none",
      });
      this.setData(
        {
          passcodeSubmitting: false,
          passcodeInputFocus: false,
        },
        () => {
          this.schedulePasscodeFocus(PASSCODE_REFOCUS_DELAY);
        },
      );
      return;
    }

    this.setData({
      passcodeDialogVisible: false,
      passcodeValue: "",
      passcodeDigits: ["", "", ""],
      passcodeActiveIndex: 0,
      passcodeInputFocus: false,
      passcodeError: "",
      passcodeSubmitting: false,
    });
    passcodeEntry.openBShellEntry(result.auth);
  },
});
