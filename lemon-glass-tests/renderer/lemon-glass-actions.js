(function () {
  "use strict";

  const ACCOUNTS_KEY = "avera.accounts.v1";
  const ACTIVE_ACCOUNT_KEY = "avera.active-account.v1";
  const PREFERENCES_KEY = "lemon-glass.preferences.v1";
  const PROFILE_KEY = "lemon-glass.profile.v1";
  const CATEGORIES_KEY = "lemon-glass.categories.v1";
  const RESET_KEY = "lemon-glass.data-reset.1.6.0";
  const PASSCODE_KEY = "lemon-glass.app-lock.passcode.v1";
  const FILTERS_KEY = "lemon-glass.calendar-filters.v1";
  const THEME_KEY = "color-scheme";
  const themeOptions = [
    ["sunshine-orange", "Sunshine Orange"],
    ["sunshine-aqua", "Sunshine Aqua"],
    ["ocean-breeze", "Ocean Breeze"],
    ["mint-garden", "Mint Garden"],
    ["lavender-dream", "Lavender Dream"],
    ["rose-quartz", "Rose Quartz"],
    ["sunset-peach", "Sunset Peach"],
    ["midnight-steel", "Midnight Steel"],
    ["forest-slate", "Forest Slate"],
    ["copper-night", "Copper Night"],
  ];
  const defaultCategories = [
    "Housing",
    "Utilities",
    "Groceries",
    "Transportation",
    "Subscriptions",
    "Entertainment",
    "Dining",
    "Shopping",
    "Health",
    "Personal",
    "Business",
    "Travel",
    "Savings",
    "Income",
    "Other",
  ];

  const readJson = (key, fallback) => {
    try {
      const value = JSON.parse(window.localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  };

  const writeJson = (key, value) => {
    window.localStorage.setItem(key, JSON.stringify(value));
  };

  function clearPreviousDataOnce() {
    if (window.localStorage.getItem(RESET_KEY)) return;
    Object.keys(window.localStorage)
      .filter(
        (key) =>
          key === ACCOUNTS_KEY ||
          key === ACTIVE_ACCOUNT_KEY ||
          key.startsWith("avera.account.") ||
          key.startsWith("avera.tutorial.") ||
          key.startsWith("lemon-glass.preferences") ||
          key.startsWith("lemon-glass.profile") ||
          key.startsWith("lemon-glass.categories") ||
          key.startsWith("lemon-glass.calendar-filters") ||
          key.startsWith("lemon-glass.app-lock"),
      )
      .forEach((key) => window.localStorage.removeItem(key));
    window.localStorage.setItem(RESET_KEY, new Date().toISOString());
  }

  clearPreviousDataOnce();

  const accountDataKey = (id) => `avera.account.${id}.data.v1`;

  const getAccounts = () => {
    const accounts = readJson(ACCOUNTS_KEY, []);
    return Array.isArray(accounts) ? accounts : [];
  };

  const getActiveAccount = () => {
    const accounts = getAccounts();
    const id = window.localStorage.getItem(ACTIVE_ACCOUNT_KEY);
    return accounts.find((account) => account.id === id) || accounts[0] || null;
  };

  const emptyData = () => ({
    openingBalance: 0,
    transactions: [],
    bills: [],
    reserves: [],
    goals: [],
    recurring: [],
    household: [],
    categoryBudgets: {},
  });

  const getData = () => {
    const account = getActiveAccount();
    return account
      ? window.LemonFinance.syncSavings({ ...emptyData(), ...readJson(accountDataKey(account.id), emptyData()) }, `${accountBudgetStartMonth()}-${String(budgetCycleStartDay()).padStart(2, "0")}`)
      : emptyData();
  };

  const updateData = (updater) => {
    const account = getActiveAccount();
    if (!account) return false;
    const before = getData();
    const next = window.LemonFinance.syncSavings(window.LemonFinance.reconcile(before, updater(before), budgetCycleStartDay()), savingsDate());
    writeJson(accountDataKey(account.id), next);
    window.dispatchEvent(new CustomEvent("lemon-glass:data-change", { detail: { data: next } }));
    return true;
  };

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const button = (label, className, action) => {
    const node = element("button", className, label);
    node.type = "button";
    if (action) node.addEventListener("click", action);
    return node;
  };

  const field = (label, value = "", type = "text", options = {}) => {
    const wrap = element("label", "lg-field");
    wrap.appendChild(element("span", "", label));
    let control;
    if (type === "select") {
      control = element("select");
      (options.options || []).forEach((entry) => {
        const option = element("option", "", entry);
        option.value = entry;
        control.appendChild(option);
      });
      control.value = value;
    } else {
      control = element("input");
      const isMoney = type === "number" && /amount|balance|rent|utilities|cost/i.test(label);
      control.type = isMoney ? "text" : type;
      if (isMoney) {
        control.inputMode = "decimal";
        control.placeholder = options.placeholder || "0,00 €";
      }
      control.value = value ?? "";
      if (options.step) control.step = options.step;
      if (options.min !== undefined) control.min = String(options.min);
      if (options.max !== undefined) control.max = String(options.max);
      if (options.placeholder) control.placeholder = options.placeholder;
    }
    wrap.appendChild(control);
    return { wrap, control };
  };

  function closeLayer(layer) {
    layer?.remove();
  }

  function modal(title, subtitle, { wide = false, dismissible = true } = {}) {
    document.querySelectorAll(".lg-layer").forEach((node) => node.remove());
    const layer = element("div", "lg-layer");
    const panel = element("section", `lg-dialog${wide ? " lg-dialog-wide" : ""}`);
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    const head = element("header", "lg-dialog-head");
    const copy = element("div");
    copy.append(element("span", "lg-eyebrow", "Lemon Glass"), element("h2", "", title));
    if (subtitle) copy.appendChild(element("p", "", subtitle));
    head.appendChild(copy);
    if (dismissible) {
      const close = button("×", "lg-close", () => closeLayer(layer));
      close.setAttribute("aria-label", "Close");
      head.appendChild(close);
    }
    const body = element("div", "lg-dialog-body");
    const actions = element("footer", "lg-dialog-actions");
    panel.append(head, body, actions);
    layer.appendChild(panel);
    if (dismissible) {
      layer.addEventListener("mousedown", (event) => {
        if (event.target === layer) closeLayer(layer);
      });
    }
    document.body.appendChild(layer);
    return { layer, panel, body, actions };
  }

  function showToast(message) {
    document.querySelectorAll(".lg-toast").forEach((node) => node.remove());
    const toast = element("div", "lg-toast", message);
    document.body.appendChild(toast);
    window.setTimeout(() => toast.remove(), 2600);
  }

  function showCalculationConflict(issues) {
    if (!issues.length || document.querySelector(".lg-calculation-conflict")) return;
    const signature = issues.map((issue) => issue.problem).join("|");
    if (window.sessionStorage.getItem("lemon-glass.last-conflict") === signature) return;
    window.sessionStorage.setItem("lemon-glass.last-conflict", signature);
    const dialog = modal(
      "Current month needs attention",
      "Lemon Glass found information that could make this month’s Available to Spend total inaccurate.",
      { wide: true },
    );
    dialog.layer.classList.add("lg-calculation-conflict");
    const list = element("div", "lg-list");
    issues.forEach(({ problem, hint }) => {
      const row = element("div", "lg-list-row");
      const copy = element("div");
      copy.append(element("strong", "", problem), element("small", "", `Hint: ${hint}`));
      row.appendChild(copy);
      list.appendChild(row);
    });
    dialog.body.appendChild(list);
    dialog.actions.append(button("Review later", "lg-button lg-button-secondary", () => closeLayer(dialog.layer)));
  }

  const numberValue = (input) => {
    const raw = String(input.value || "").trim().replace(/\s/g, "").replace(/€/g, "");
    const normalized = raw.includes(",")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw;
    const value = Number(normalized);
    return Number.isFinite(value) ? value : 0;
  };

  const monthFromDate = (value) => {
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? new Date().getMonth() : date.getMonth();
  };

  const addMonths = (value, count) => {
    const source = new Date(`${value}T12:00:00`);
    if (Number.isNaN(source.getTime())) return value;
    const targetMonth = source.getMonth() + count;
    const lastDay = new Date(source.getFullYear(), targetMonth + 1, 0).getDate();
    const target = new Date(
      source.getFullYear(),
      targetMonth,
      Math.min(source.getDate(), lastDay),
      12,
    );
    return target.toISOString().slice(0, 10);
  };

  const formatMoney = (value) => {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
      .format(Number(value) || 0)
      .replace(/\s+(?=€)/, "");
  };

  const cycleKeyFromDate = (value) => {
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return "";
    if (date.getDate() < budgetCycleStartDay()) date.setMonth(date.getMonth() - 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  };

  const currentCycleKey = () => cycleKeyFromDate(new Date().toISOString().slice(0, 10));

  const memberPaidForCycle = (member, cycleKey = selectedBudgetMonth()) =>
    Number(member?.paidByCycle?.[cycleKey] || 0);

  const addMemberPayment = (member, amount, date) => {
    const cycleKey = cycleKeyFromDate(date);
    return {
      ...member,
      paid: 0,
      paidByCycle: {
        ...(member.paidByCycle || {}),
        [cycleKey]: memberPaidForCycle(member, cycleKey) + Number(amount || 0),
      },
    };
  };

  function validateCurrentMonth(data = getData()) {
    const issues = [];
    const validAmount = (value) => Number.isFinite(Number(value)) && Number(value) >= 0;
    [...data.transactions, ...data.bills, ...data.reserves, ...data.recurring].forEach((entry) => {
      const name = entry.name || entry.merchant || "Unnamed item";
      if (!validAmount(entry.amount)) {
        issues.push({
          problem: `${name} has an invalid amount.`,
          hint: "Edit it and enter an amount such as 1,00 €.",
        });
      }
    });
    data.reserves.forEach((entry) => {
      if (!entry.reservedAt) {
        issues.push({
          problem: `${entry.name || "A reserve"} has no reserved date.`,
          hint: "Release it and add it again with the date the money was reserved.",
        });
      }
    });
    const transactions = data.transactions.filter(
      (entry) => cycleKeyFromDate(entry.date || entry.paidDate || "") === currentCycleKey(),
    );
    data.recurring.forEach((entry) => {
      const matches = transactions.filter(
        (transaction) =>
          transaction.type === "expense" &&
          (String(transaction.recurringId) === String(entry.id) ||
            (transaction.recurring && transaction.merchant === entry.name)),
      );
      if (matches.length > 1) {
        issues.push({
          problem: `${entry.name} appears paid more than once this cycle.`,
          hint: "Open Transactions and remove the duplicate payment.",
        });
      }
    });
    showCalculationConflict(issues.slice(0, 6));
    return issues;
  }

  const formatDate = (value) => {
    const date = value instanceof Date ? value : new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return "";
    return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
  };

  const budgetYear = () => {
    const accountYear = Number(getActiveAccount()?.year);
    if (Number.isInteger(accountYear) && accountYear > 1900) return accountYear;
    const savedYear = Number(preferenceValue("budget-year", new Date().getFullYear()));
    return Number.isInteger(savedYear) && savedYear > 1900
      ? savedYear
      : new Date().getFullYear();
  };

  const monthKey = (value = new Date()) => {
    const date = value instanceof Date ? value : new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  };

  const accountBudgetStartMonth = () =>
    getActiveAccount()?.budgetStartMonth || monthKey(new Date());

  const addMonthsToKey = (key, count) => {
    const date = new Date(`${key}-01T12:00:00`);
    if (Number.isNaN(date.getTime())) return key;
    date.setMonth(date.getMonth() + count);
    return monthKey(date);
  };

  const accountBudgetEndMonth = () =>
    addMonthsToKey(
      accountBudgetStartMonth(),
      Math.max(1, Number(getActiveAccount()?.budgetDuration) || 12) - 1,
    );

  const selectedBudgetMonth = () =>
    window.sessionStorage.getItem("lemon-glass.selected-budget-month") || accountBudgetStartMonth();

  function setSelectedBudgetMonth(value) {
    if (/^\d{4}-\d{2}$/.test(value || "")) {
      window.sessionStorage.setItem("lemon-glass.selected-budget-month", value);
    }
  }

  const dateIsInBudget = (value) => {
    const key = cycleKeyFromDate(value);
    return Boolean(key && key >= accountBudgetStartMonth() && key <= accountBudgetEndMonth());
  };

  function validateBudgetDate(value, onAdjust, label = "date") {
    if (dateIsInBudget(value)) return true;
    const start = accountBudgetStartMonth();
    const end = accountBudgetEndMonth();
    const suggestedMonth = value && cycleKeyFromDate(value) < start ? start : end;
    const suggested = `${suggestedMonth}-${String(Math.min(28, budgetCycleStartDay())).padStart(2, "0")}`;
    const dialog = modal(
      "Date is outside this budget",
      `This account accepts entries only from ${start} through ${end}.`,
      { wide: true },
    );
    const adjusted = field("Adjusted date", suggested, "date", {
      min: `${start}-01`,
      max: `${end}-28`,
    });
    dialog.body.append(
      element(
        "p",
        "lg-callout",
        `The selected ${label} was not saved. Choose a date inside this account’s budget period.`,
      ),
      adjusted.wrap,
    );
    dialog.actions.append(
      button("Cancel", "lg-button lg-button-secondary", () => closeLayer(dialog.layer)),
      button("Use adjusted date", "lg-button lg-button-primary", () => {
        if (!dateIsInBudget(adjusted.control.value)) {
          return showToast("Choose a date inside the budget period");
        }
        onAdjust?.(adjusted.control.value);
        closeLayer(dialog.layer);
        showToast("Date adjusted — review and save again");
      }),
    );
    return false;
  }

  const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

  function download(name, content, type) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([content], { type }));
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function getCategories() {
    const categories = readJson(CATEGORIES_KEY, defaultCategories);
    return Array.isArray(categories) && categories.length ? categories : [...defaultCategories];
  }

  function saveCategories(categories) {
    writeJson(CATEGORIES_KEY, categories);
    window.dispatchEvent(
      new CustomEvent("lemon-glass:data-change", { detail: { data: getData() } }),
    );
  }

  function preference(name, fallback = false) {
    const preferences = readJson(PREFERENCES_KEY, {});
    return Object.hasOwn(preferences, name) ? Boolean(preferences[name]) : fallback;
  }

  function setPreference(name, value) {
    writeJson(PREFERENCES_KEY, {
      ...readJson(PREFERENCES_KEY, {}),
      [name]: Boolean(value),
    });
  }

  function preferenceValue(name, fallback) {
    const preferences = readJson(PREFERENCES_KEY, {});
    return Object.hasOwn(preferences, name) ? preferences[name] : fallback;
  }

  function setPreferenceValue(name, value) {
    writeJson(PREFERENCES_KEY, {
      ...readJson(PREFERENCES_KEY, {}),
      [name]: value,
    });
  }

  function budgetCycleStartDay() {
    const value = Number(preferenceValue("budget-cycle-start-day", 6));
    return Math.min(28, Math.max(1, Number.isFinite(value) ? Math.round(value) : 6));
  }

  function budgetCycleMonthFromDate(value) {
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return new Date().getMonth();
    const month = date.getMonth() - (date.getDate() < budgetCycleStartDay() ? 1 : 0);
    return (month + 12) % 12;
  }

  function applyTheme(name = preferenceValue(THEME_KEY, "sunshine-orange")) {
    const available = themeOptions.some(([value]) => value === name);
    const selected = available ? name : "sunshine-orange";
    document.documentElement.dataset.theme = selected;
    setPreferenceValue(THEME_KEY, selected);
    return selected;
  }

  function getCategoryBudgets(month) {
    const budgets = getData().categoryBudgets;
    return budgets && typeof budgets === "object" && budgets[String(month)]
      ? { ...budgets[String(month)] }
      : {};
  }

  function configureBudget(month = new Date().getMonth()) {
    const selectedMonth = Number(month);
    const current = getCategoryBudgets(selectedMonth);
    const dialog = modal(
      `Set ${new Date(budgetYear(), selectedMonth, 1).toLocaleString("en", { month: "long" })} budgets`,
      "Assign an amount to any category. Actual spending and recurring commitments update automatically.",
      { wide: true },
    );
    const grid = element("div", "lg-form-grid lg-budget-fields");
    const inputs = getCategories().map((categoryName) => {
      const entry = field(categoryName, current[categoryName] || "", "number", {
        step: "0.01",
        min: 0,
      });
      grid.appendChild(entry.wrap);
      return [categoryName, entry.control];
    });
    dialog.body.append(
      element(
        "p",
        "lg-callout",
        "Leave a category blank to use its active recurring commitment as the suggested budget.",
      ),
      grid,
    );
    dialog.actions.append(
      button("Cancel", "lg-button lg-button-secondary", () => closeLayer(dialog.layer)),
      button("Save category budgets", "lg-button lg-button-primary", () => {
        const next = {};
        inputs.forEach(([categoryName, control]) => {
          const value = numberValue(control);
          if (value > 0) next[categoryName] = value;
        });
        updateData((data) => ({
          ...data,
          categoryBudgets: {
            ...(data.categoryBudgets || {}),
            [String(selectedMonth)]: next,
          },
        }));
        closeLayer(dialog.layer);
        showToast("Monthly category budgets saved");
      }),
    );
  }

  function navigate(label) {
    const item = Array.from(document.querySelectorAll(".nav-item, .bottom-nav button")).find(
      (node) => node.textContent.trim().includes(label),
    );
    item?.click();
  }

  function openCategoriesPage() {
    navigate("Settings");
    window.setTimeout(() => {
      const categoryLink = Array.from(document.querySelectorAll(".settings-link")).find(
        (node) => node.textContent.trim() === "Categories",
      );
      categoryLink?.click();
    }, 80);
  }

  function editTransaction(id) {
    const transaction = getData().transactions.find((entry) => String(entry.id) === String(id));
    if (!transaction) return;
    const dialog = modal("Edit transaction", "Update the details or remove this transaction.", {
      wide: true,
    });
    const form = element("div", "lg-form-grid");
    const merchant = field("Merchant", transaction.merchant);
    const description = field("Description", transaction.description || "");
    const amount = field("Amount", transaction.amount, "number", { step: "0.01", min: 0 });
    const date = field("Date", transaction.date, "date");
    const category = field("Category", transaction.category, "select", {
      options: getCategories(),
    });
    const type = field("Type", transaction.type, "select", { options: ["expense", "income"] });
    category.control.addEventListener("change", () => { if (category.control.value === "Income") type.control.value = "income"; });
    const method = field("Payment method", transaction.paymentMethod || "");
    const cleared = field("Cleared", transaction.cleared ? "Yes" : "No", "select", {
      options: ["Yes", "No"],
    });
    [merchant, description, amount, date, category, type, method, cleared].forEach((entry) =>
      form.appendChild(entry.wrap),
    );
    dialog.body.appendChild(form);
    dialog.actions.append(
      button("Delete transaction", "lg-button lg-button-danger", () => {
        closeLayer(dialog.layer);
        deleteTransaction(id);
      }),
      button("Cancel", "lg-button lg-button-secondary", () => closeLayer(dialog.layer)),
      button("Save changes", "lg-button lg-button-primary", () => {
        if (!window.LemonFinance.validTransactionAmount(numberValue(amount.control))) {
          return showToast("Enter an amount greater than zero. Choose Income or Expense to set its direction.");
        }
        if (!merchant.control.value.trim() || !date.control.value) {
          showToast("Add a merchant, amount, and date first");
          return;
        }
        if (!window.LemonFinance.opening(transaction) && !validateBudgetDate(date.control.value, (value) => { date.control.value = value; }, "transaction date")) return;
        updateData((data) => ({
          ...data,
          transactions: data.transactions.map((entry) =>
            String(entry.id) === String(id)
              ? {
                  ...entry,
                  merchant: merchant.control.value.trim(),
                  description: description.control.value.trim(),
                  amount: numberValue(amount.control),
                  date: date.control.value,
                  month: monthFromDate(date.control.value),
                  ...(window.LemonFinance.opening(entry) ? { openingMonth: date.control.value.slice(0, 7) } : {}),
                  category: category.control.value,
                  type: type.control.value,
                  paymentMethod: method.control.value.trim(),
                  cleared: cleared.control.value === "Yes",
                }
              : entry,
          ),
        }));
        closeLayer(dialog.layer);
        showToast("Transaction updated");
      }),
    );
  }

  function deleteTransaction(id) {
    const transaction = getData().transactions.find((entry) => String(entry.id) === String(id));
    if (!transaction) return;
    const dialog = modal("Delete transaction?", `${transaction.merchant} · ${formatMoney(transaction.amount)}`);
    dialog.body.appendChild(
      element("p", "lg-callout", "This removes the transaction from this account. This action cannot be undone."),
    );
    dialog.actions.append(
      button("Cancel", "lg-button lg-button-secondary", () => closeLayer(dialog.layer)),
      button("Delete", "lg-button lg-button-danger", () => {
        updateData((data) => ({
          ...data,
          transactions: data.transactions.filter((entry) => String(entry.id) !== String(id)),
        }));
        closeLayer(dialog.layer);
        showToast("Transaction deleted");
      }),
    );
  }

  function exportTransactions() {
    const rows = getData().transactions;
    const header = [
      "Date",
      "Merchant",
      "Description",
      "Type",
      "Category",
      "Amount",
      "Payment method",
      "Cleared",
    ];
    const csv = [
      header.map(csvCell).join(","),
      ...rows.map((entry) =>
        [
          formatDate(entry.date),
          entry.merchant,
          entry.description,
          entry.type,
          entry.category,
          entry.amount,
          entry.paymentMethod,
          entry.cleared ? "Yes" : "No",
        ]
          .map(csvCell)
          .join(","),
      ),
    ].join("\r\n");
    download(
      `lemon-glass-transactions-${new Date().toISOString().slice(0, 10)}.csv`,
      `\ufeff${csv}`,
      "text/csv;charset=utf-8",
    );
    showToast(`${rows.length} transactions exported`);
  }

  function editCategory(name) {
    const dialog = modal("Edit category", "Rename the category everywhere it is currently used.");
    const category = field("Category name", name);
    dialog.body.appendChild(category.wrap);
    dialog.actions.append(
      button("Delete", "lg-button lg-button-danger", () => {
        const categories = getCategories();
        if (categories.length <= 1) {
          showToast("Keep at least one category");
          return;
        }
        const replacement = name === "Other" ? categories.find((entry) => entry !== name) : "Other";
        closeLayer(dialog.layer);
        const confirmation = modal(
          `Delete ${name}?`,
          `Items using this category will move to ${replacement}.`,
        );
        confirmation.body.appendChild(
          element("p", "lg-callout", "The category will also be removed from every monthly budget."),
        );
        confirmation.actions.append(
          button("Cancel", "lg-button lg-button-secondary", () => closeLayer(confirmation.layer)),
          button("Delete category", "lg-button lg-button-danger", () => {
            updateData((data) => ({
              ...data,
              transactions: data.transactions.map((entry) =>
                entry.category === name ? { ...entry, category: replacement } : entry,
              ),
              bills: data.bills.map((entry) =>
                entry.category === name ? { ...entry, category: replacement } : entry,
              ),
              recurring: data.recurring.map((entry) =>
                entry.category === name ? { ...entry, category: replacement } : entry,
              ),
              categoryBudgets: Object.fromEntries(
                Object.entries(data.categoryBudgets || {}).map(([month, budgets]) => [
                  month,
                  Object.fromEntries(
                    Object.entries(budgets || {}).filter(([categoryName]) => categoryName !== name),
                  ),
                ]),
              ),
            }));
            saveCategories(categories.filter((entry) => entry !== name));
            closeLayer(confirmation.layer);
            showToast("Category deleted");
          }),
        );
      }),
      button("Cancel", "lg-button lg-button-secondary", () => closeLayer(dialog.layer)),
      button("Save", "lg-button lg-button-primary", () => {
        const next = category.control.value.trim();
        if (!next) return showToast("Enter a category name");
        const categories = getCategories();
        if (categories.some((entry) => entry !== name && entry.toLowerCase() === next.toLowerCase())) {
          return showToast("That category already exists");
        }
        saveCategories(categories.map((entry) => (entry === name ? next : entry)));
        updateData((data) => ({
          ...data,
          transactions: data.transactions.map((entry) =>
            entry.category === name ? { ...entry, category: next } : entry,
          ),
          bills: data.bills.map((entry) =>
            entry.category === name ? { ...entry, category: next } : entry,
          ),
          recurring: data.recurring.map((entry) =>
            entry.category === name ? { ...entry, category: next } : entry,
          ),
        }));
        closeLayer(dialog.layer);
        showToast("Category updated");
      }),
    );
    category.control.focus();
  }

  function addCategory() {
    const dialog = modal("Add category", "Create a category for budgets, transactions, and bills.");
    const category = field("Category name", "", "text", { placeholder: "e.g. Education" });
    dialog.body.appendChild(category.wrap);
    dialog.actions.append(
      button("Cancel", "lg-button lg-button-secondary", () => closeLayer(dialog.layer)),
      button("Add category", "lg-button lg-button-primary", () => {
        const next = category.control.value.trim();
        if (!next) return showToast("Enter a category name");
        const categories = getCategories();
        if (categories.some((entry) => entry.toLowerCase() === next.toLowerCase())) {
          return showToast("That category already exists");
        }
        saveCategories([...categories, next]);
        closeLayer(dialog.layer);
        showToast("Category added");
      }),
    );
    category.control.focus();
  }

  function backupData() {
    const account = getActiveAccount();
    if (!account) return showToast("Create an account before making a backup");
    const payload = {
      product: "Lemon Glass",
      version: "1.6.0",
      exportedAt: new Date().toISOString(),
      account,
      data: getData(),
      categories: getCategories(),
      preferences: readJson(PREFERENCES_KEY, {}),
      profile: readJson(PROFILE_KEY, {}),
    };
    download(
      `lemon-glass-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2),
      "application/json;charset=utf-8",
    );
    showToast("Local backup downloaded");
  }

  function parseBackup(text) {
    const payload = JSON.parse(text.replace(/^\uFEFF/, ""));
    const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
    if (!object(payload) || payload.product !== "Lemon Glass" || payload.version !== "1.6.0" ||
        !object(payload.account) || !object(payload.data)) throw Error("Choose a Lemon Glass JSON backup.");
    const { account, data } = payload;
    if (typeof account.name !== "string" || !account.name.trim() ||
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(account.budgetStartMonth) ||
        !Number.isInteger(account.budgetDuration) || account.budgetDuration < 1 || account.budgetDuration > 120 ||
        !Number.isFinite(data.openingBalance)) throw Error("The backup has invalid account details.");
    for (const key of ["transactions", "bills", "reserves", "goals", "recurring", "household"]) {
      if (!Array.isArray(data[key]) || data[key].some(entry => !object(entry) ||
          !["string", "number"].includes(typeof entry.id))) throw Error("The backup contains invalid financial data.");
    }
    if (!object(data.categoryBudgets) ||
        (payload.categories !== undefined && (!Array.isArray(payload.categories) ||
          payload.categories.some(name => typeof name !== "string" || !name.trim())))) {
      throw Error("The backup contains invalid categories.");
    }
    return payload;
  }

  function restoreBackup(payload) {
    // Revalidate at commit; never use the exported ID to overwrite an account.
    payload = parseBackup(JSON.stringify(payload));
    const accounts = getAccounts();
    const id = `restored-${window.crypto.randomUUID()}`;
    const account = { ...payload.account, id, name: `${payload.account.name} (restored)` };
    const data = window.LemonFinance.syncSavings(payload.data, `${account.budgetStartMonth}-01`);
    const writes = [
      [accountDataKey(id), JSON.stringify(data)],
      [`avera.tutorial.${id}.v1`, "complete"],
      [CATEGORIES_KEY, JSON.stringify([...new Set([...getCategories(), ...(payload.categories || [])])])],
      [ACCOUNTS_KEY, JSON.stringify([...accounts, account])],
      [ACTIVE_ACCOUNT_KEY, id],
    ];
    const before = writes.map(([key]) => [key, window.localStorage.getItem(key)]);
    try {
      for (const [key, value] of writes) window.localStorage.setItem(key, value);
    } catch (error) {
      for (const [key, value] of before.reverse()) {
        // Unchanged keys need no write (including a storage-quota failure).
        if (window.localStorage.getItem(key) === value) continue;
        if (value === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, value);
      }
      throw error;
    }
    return account;
  }

  function loadBackup() {
    const dialog = modal("Load backup", "Bring your saved account back into Lemon Glass.");
    const label = element("label", "lg-field");
    const input = element("input");
    input.type = "file";
    input.accept = ".json,application/json";
    label.append(element("span", "", "Lemon Glass backup (.json)"), input);
    const status = element("p", "lg-callout", "Your backup will open as a separate restored account. Existing accounts, preferences and profile stay unchanged. Saved custom categories will be added.");
    status.setAttribute("aria-live", "polite");
    dialog.body.append(label, status);
    let payload = null, reading = 0, committed = false;
    const cancel = () => { reading++; payload = null; closeLayer(dialog.layer); };
    const restore = button("Load backup", "lg-button lg-button-primary", () => {
      if (!payload || committed || !dialog.layer.isConnected) return;
      restore.disabled = true;
      try {
        restoreBackup(payload);
        committed = true;
      } catch {
        status.textContent = "The backup could not be saved. Your existing accounts have not been replaced. Free some storage and try again.";
        restore.disabled = false;
        return;
      }
      closeLayer(dialog.layer);
      window.location.reload();
    });
    restore.disabled = true;
    input.addEventListener("change", async () => {
      const request = ++reading;
      payload = null;
      restore.disabled = true;
      const file = input.files[0];
      if (!file) return;
      status.textContent = "Checking backup…";
      try {
        const next = parseBackup(await file.text());
        if (request !== reading || !dialog.layer.isConnected) return;
        payload = next;
        status.textContent = `Load ${next.account.name} as a separate restored account? ${next.data.transactions.length} transactions and ${next.data.goals.length} savings goals. Existing accounts, preferences and profile stay unchanged. Saved custom categories will be added.`;
        restore.disabled = false;
      } catch {
        if (request === reading && dialog.layer.isConnected) status.textContent = "This file could not be read as a supported Lemon Glass backup. Choose the JSON file created by Download.";
      }
    });
    dialog.layer.addEventListener("keydown", event => {
      if (event.key === "Escape") { event.preventDefault(); cancel(); }
    });
    dialog.actions.append(button("Cancel", "lg-button lg-button-secondary", cancel), restore);
    input.focus();
  }

  function editGoal(id) {
    const goal = getData().goals.find((entry) => String(entry.id) === String(id));
    if (!goal) return;
    const dialog = modal("Edit savings goal", "Keep the target and monthly plan up to date.", {
      wide: true,
    });
    const form = element("div", "lg-form-grid");
    const name = field("Goal name", goal.name);
    const current = field("Saved so far", goal.current, "number", { step: "0.01", min: 0 });
    const target = field("Target amount", goal.target, "number", { step: "0.01", min: 0 });
    const monthsRemaining = (targetDate) => {
      const targetDateValue = new Date(`${targetDate}T12:00:00`);
      const today = new Date();
      if (Number.isNaN(targetDateValue.getTime())) return 1;
      return Math.max(
        1,
        (targetDateValue.getFullYear() - today.getFullYear()) * 12 +
          targetDateValue.getMonth() -
          today.getMonth(),
      );
    };
    const suggestedContribution = () =>
      Math.max(
        0,
        (numberValue(target.control) - numberValue(current.control)) /
          monthsRemaining(date.control.value),
      );
    const monthly = field("Current contribution", goal.monthly, "number", { step: "0.01", min: 0 });
    const date = field("Target date", goal.targetDate, "date");
    [name, current, target, monthly, date].forEach((entry) => form.appendChild(entry.wrap));
    const suggestion = button("Use suggested amount", "lg-button lg-button-secondary", () => {
      monthly.control.value = suggestedContribution().toFixed(2);
      showToast(`Suggested contribution set to ${formatMoney(monthly.control.value)}`);
    });
    dialog.body.append(form, suggestion, element("p", "lg-empty", "Deleting this goal releases its saved money back to Available to Spend. Your bank balance stays the same."));
    dialog.actions.append(
      button("Delete goal", "lg-button lg-button-danger", () => {
        updateData((data) => ({
          ...data,
          goals: data.goals.filter((entry) => String(entry.id) !== String(id)),
        }));
        closeLayer(dialog.layer);
        showToast("Savings goal deleted. Linked reserves released.");
      }),
      button("Cancel", "lg-button lg-button-secondary", () => closeLayer(dialog.layer)),
      button("Save", "lg-button lg-button-primary", () => {
        if (!name.control.value.trim() || numberValue(target.control) <= 0 || !date.control.value) {
          return showToast("Add a name, target, and date first");
        }
        updateData((data) => ({
          ...data,
          goals: data.goals.map((entry) =>
            String(entry.id) === String(id)
              ? {
                  ...entry,
                  name: name.control.value.trim(),
                  current: numberValue(current.control),
                  target: numberValue(target.control),
                  monthly: numberValue(monthly.control),
                  targetDate: date.control.value,
                }
              : entry,
          ),
        }));
        closeLayer(dialog.layer);
        showToast("Savings goal updated");
      }),
    );
  }

  function manageGoals() {
    const goals = getData().goals;
    const dialog = modal("Manage savings goals", "Review, edit, or remove active goals.", {
      wide: true,
    });
    if (!goals.length) {
      dialog.body.appendChild(element("p", "lg-empty", "No savings goals yet. Use New goal to create one."));
    } else {
      const list = element("div", "lg-list");
      goals.forEach((goal) => {
        const row = element("div", "lg-list-row");
        const copy = element("div");
        copy.append(element("strong", "", goal.name), element("small", "", `${formatMoney(goal.current)} of ${formatMoney(goal.target)}`));
        row.append(copy, button("Edit", "lg-button lg-button-secondary", () => editGoal(goal.id)));
        list.appendChild(row);
      });
      dialog.body.appendChild(list);
    }
    dialog.actions.append(button("Done", "lg-button lg-button-primary", () => closeLayer(dialog.layer)));
  }

  function moneyAsideHelp() {
    const dialog = modal("How Money Reserve works", "Protect money without moving anything out of your bank account.", {
      wide: true,
    });
    const steps = element("div", "lg-help-grid");
    [
      ["1", "Create a reserve", "Choose a name, amount, and purpose."],
      ["2", "Available money adjusts", "The reserve is subtracted from safe-to-spend money, not your bank balance."],
      ["3", "Release it anytime", "When the money is no longer needed, release it back to available."],
    ].forEach(([number, title, copy]) => {
      const item = element("div", "lg-help-card");
      item.append(element("span", "lg-step", number), element("strong", "", title), element("p", "", copy));
      steps.appendChild(item);
    });
    dialog.body.appendChild(steps);
    dialog.actions.append(button("Got it", "lg-button lg-button-primary", () => closeLayer(dialog.layer)));
  }

  function addRecurring(typeHint = "expense") {
    const dialog = modal(
      "Add recurring item",
      "Schedule income or expenses. Record each payment when it happens.",
      { wide: true },
    );
    const form = element("div", "lg-form-grid");
    const name = field("Name", "", "text", { placeholder: "e.g. Internet" });
    const amount = field("Amount", "", "number", { step: "0.01", min: 0 });
    const day = field("Due day", "", "number", { min: 1, max: 31 });
    const category = field("Category", "", "select", {
      options: ["", ...getCategories()],
    });
    category.control.options[0].textContent = "Choose category";
    const frequency = field("Frequency", "Monthly", "select", {
      options: ["Monthly", "Quarterly", "Yearly"],
    });
    const startMonth = field("Start month", accountBudgetStartMonth(), "month", {
      min: accountBudgetStartMonth(),
      max: accountBudgetEndMonth(),
    });
    const type = field("Type", typeHint, "select", { options: ["expense", "income"] });
    if (typeHint === "income") category.control.value = "Income";
    category.control.addEventListener("change", () => {
      if (category.control.value === "Income") { type.control.value = "income"; }
    });
    const reserved = field("Reserve this amount", "No", "select", {
      options: ["No", "Yes"],
    });
    [name, amount, day, category, type, frequency, startMonth, reserved].forEach((entry) =>
      form.appendChild(entry.wrap),
    );
    dialog.body.appendChild(form);
    dialog.actions.append(
      button("Cancel", "lg-button lg-button-secondary", () => closeLayer(dialog.layer)),
      button("Save recurring item", "lg-button lg-button-primary", () => {
        const dueDay = Math.round(numberValue(day.control));
        if (
          !name.control.value.trim() ||
          numberValue(amount.control) <= 0 ||
          dueDay < 1 ||
          dueDay > 31 ||
          !category.control.value
        ) {
          return showToast("Add a name, amount, due day, and category first");
        }
        updateData((data) => ({
          ...data,
          recurring: [
            ...data.recurring,
            {
              id: Date.now(),
              name: name.control.value.trim(),
              amount: numberValue(amount.control),
              dueDay,
              category: type.control.value === "income" ? "Income" : category.control.value,
              type: type.control.value,
              frequency: frequency.control.value,
              startMonthKey: startMonth.control.value || accountBudgetStartMonth(),
              startMonth: monthFromDate(`${startMonth.control.value || accountBudgetStartMonth()}-01`),
              reserved: reserved.control.value === "Yes",
              paused: false,
            },
          ],
        }));
        closeLayer(dialog.layer);
        showToast("Recurring item saved");
      }),
    );
    name.control.focus();
  }

  function editRecurring(id) {
    const recurring = getData().recurring.find((entry) => String(entry.id) === String(id));
    if (!recurring) return;
    const dialog = modal("Edit recurring item", "Update the schedule and monthly amount.");
    const name = field("Name", recurring.name);
    const amount = field("Amount", recurring.amount, "number", { step: "0.01", min: 0 });
    const day = field("Due day", recurring.dueDay, "number", { min: 1, max: 31 });
    const frequency = field("Frequency", recurring.frequency || "Monthly", "select", {
      options: ["Monthly", "Quarterly", "Yearly"],
    });
    const startMonth = field(
      "Start month",
      recurring.startMonthKey || `${budgetYear()}-${String((Number.isInteger(recurring.startMonth) ? recurring.startMonth : 0) + 1).padStart(2, "0")}`,
      "month",
      { min: accountBudgetStartMonth(), max: accountBudgetEndMonth() },
    );
    const category = field("Category", recurring.category || "Other", "select", {
      options: getCategories(),
    });
    const type = field("Type", window.LemonFinance.kind(recurring), "select", { options: ["expense", "income"] });
    category.control.addEventListener("change", () => {
      if (category.control.value === "Income") { type.control.value = "income"; }
    });
    const reserved = field("Reserve this amount", recurring.reserved ? "Yes" : "No", "select", {
      options: ["No", "Yes"],
    });
    [name, amount, day, category, type, frequency, startMonth, reserved].forEach((entry) =>
      dialog.body.appendChild(entry.wrap),
    );
    dialog.actions.append(
      button("Delete", "lg-button lg-button-danger", () => {
        updateData((data) => ({
          ...data,
          recurring: data.recurring.filter((entry) => String(entry.id) !== String(id)),
        }));
        closeLayer(dialog.layer);
        showToast("Recurring item deleted");
      }),
      button("Cancel", "lg-button lg-button-secondary", () => closeLayer(dialog.layer)),
      button("Save", "lg-button lg-button-primary", () => {
        updateData((data) => ({
          ...data,
          recurring: data.recurring.map((entry) =>
            String(entry.id) === String(id)
              ? {
                  ...entry,
                  name: name.control.value.trim() || entry.name,
                  amount: numberValue(amount.control),
                  dueDay: Math.min(31, Math.max(1, Math.round(numberValue(day.control)))),
                  category: type.control.value === "income" ? "Income" : category.control.value,
              type: type.control.value,
                  frequency: frequency.control.value,
                  startMonthKey: startMonth.control.value || entry.startMonthKey || accountBudgetStartMonth(),
                  startMonth: monthFromDate(`${startMonth.control.value || entry.startMonthKey || accountBudgetStartMonth()}-01`),
                  reserved: reserved.control.value === "Yes",
                  reserveReleasedCycles: (entry.reserveReleasedCycles || []).filter(key => key !== selectedBudgetMonth()),
                }
              : entry,
          ),
        }));
        closeLayer(dialog.layer);
        showToast("Recurring item updated");
      }),
    );
  }

  const savingsDate = () => `${selectedBudgetMonth()}-${String(budgetCycleStartDay()).padStart(2, "0")}`;

  function contributeSavings(id, amount) {
    let added = 0;
    updateData(data => {
      const before = data.goals.find(g => String(g.id) === String(id));
      const next = window.LemonFinance.contributeSavings(data, id, amount, savingsDate());
      added = window.LemonFinance.money((next.goals.find(g => String(g.id) === String(id))?.current || 0) - (before?.current || 0));
      return next;
    });
    showToast(added > 0 ? `${formatMoney(added)} added to savings` : 'Goal already fully funded');
  }

  function releaseReserve(entry) {
    if (entry.goalId != null) {
      updateData(data => window.LemonFinance.releaseSavings(data, entry.id, savingsDate()));
      showToast('Savings released back to available');
      return;
    }
    if (entry.reserveSource === 'recurring') {
      updateData(data => ({...data, recurring:data.recurring.map(r => String(r.id) === String(entry.sourceId)
        ? {...r, reserveReleasedCycles:[...new Set([...(r.reserveReleasedCycles || []), entry.cycleKey])] } : r)}));
      showToast('Reserve released for this cycle. Unpaid expenses remain in the budget.');
    } else if (entry.reserveSource === 'bill') {
      updateData(data => ({...data,bills:data.bills.map(b => String(b.id) === String(entry.sourceId) ? {...b,reserved:0} : b)}));
      showToast('Bill reserve released');
    }
  }

  function showSchedule() {
    const recurring = getData().recurring;
    const dialog = modal("Recurring schedule", "Every repeating cost, due day, and current status.", {
      wide: true,
    });
    if (!recurring.length) {
      dialog.body.appendChild(element("p", "lg-empty", "No recurring expenses have been scheduled yet."));
    } else {
      const list = element("div", "lg-list");
      recurring.forEach((entry) => {
        const row = element("div", "lg-list-row");
        const copy = element("div");
        copy.append(
          element("strong", "", entry.name),
          element("small", "", `${entry.frequency || "Monthly"} · day ${entry.dueDay} · ${entry.paused ? "Paused" : "Active"}`),
        );
        row.append(copy, element("b", "", formatMoney(entry.amount)), button("Edit", "lg-button lg-button-secondary", () => editRecurring(entry.id)));
        list.appendChild(row);
      });
      dialog.body.appendChild(list);
    }
    dialog.actions.append(button("Done", "lg-button lg-button-primary", () => closeLayer(dialog.layer)));
  }

  function payRecurring(id) {
    const recurring = getData().recurring.find((entry) => String(entry.id) === String(id));
    if (!recurring) return showToast("That recurring expense is no longer available");
    const isIncome = window.LemonFinance.kind(recurring) === "income";
    const dialog = modal(
      `Record ${recurring.name}`,
      isIncome
        ? "Record this income once per budget cycle. You can edit the receipt in Transactions."
        : "Record this payment once per budget cycle. You can edit the payment in Transactions.",
    );
    const date = field("Payment date", new Date().toISOString().slice(0, 10), "date");
    const amount = field("Amount", recurring.amount, "number", { step: "0.01", min: 0 });
    const cleared = field("Cleared by the bank", "Yes", "select", {
      options: ["Yes", "No"],
    });
    dialog.body.append(amount.wrap, date.wrap, cleared.wrap);
    dialog.actions.append(
      button("Cancel", "lg-button lg-button-secondary", () => closeLayer(dialog.layer)),
      button(isIncome ? "Record income" : "Record payment", "lg-button lg-button-primary", () => {
        if (numberValue(amount.control) <= 0) return showToast("Enter a positive amount");
        if (!date.control.value) return showToast("Choose the payment date");
        if (!validateBudgetDate(date.control.value, (value) => { date.control.value = value; }, "payment date")) return;
        // Read persisted activity at submission, not when the dialog opened.
        // This also catches rapid repeat clicks and a second already-open dialog.
        if (window.LemonFinance.recordedRecurringPayment(getData(), recurring, date.control.value, budgetCycleStartDay())) {
          return showToast(isIncome
            ? "Income already recorded for this budget cycle. Review or edit it in Transactions."
            : "Payment already recorded for this budget cycle. Review or edit it in Transactions.");
        }
        updateData((data) => ({
          ...data,
          transactions: [
            {
              id: Date.now(),
              recurringId: recurring.id,
              merchant: recurring.name,
              description: `${recurring.name} recurring payment`,
              amount: numberValue(amount.control),
              type: window.LemonFinance.kind(recurring),
              category: window.LemonFinance.kind(recurring) === "income" ? "Income" : recurring.category || "Other",
              date: date.control.value,
              month: monthFromDate(date.control.value),
              cleared: cleared.control.value === "Yes",
              recurring: true,
              paymentMethod: "Recurring payment",
            },
            ...data.transactions,
          ],
        }));
        closeLayer(dialog.layer);
        showToast(isIncome ? "Recurring income added to Transactions" : "Recurring payment added to Transactions");
      }),
    );
  }

  function payBill(id, monthConfirmed = false) {
    const bill = getData().bills.find((entry) => String(entry.id) === String(id));
    if (!bill) return showToast("That bill is no longer available");
    const billMonth = cycleKeyFromDate(bill.due);
    const openMonth = selectedBudgetMonth();
    if (!monthConfirmed && billMonth && openMonth && billMonth !== openMonth) {
      const warning = modal(
        "Bill belongs to another month",
        `${bill.name} is assigned to ${billMonth}, while the open budget tab is ${openMonth}.`,
        { wide: true },
      );
      warning.body.appendChild(
        element(
          "p",
          "lg-callout",
          "Continue only if you intend to record this payment while viewing a different month.",
        ),
      );
      warning.actions.append(
        button("Cancel", "lg-button lg-button-secondary", () => closeLayer(warning.layer)),
        button("Continue to payment", "lg-button lg-button-primary", () => {
          closeLayer(warning.layer);
          payBill(id, true);
        }),
      );
      return;
    }
    const dialog = modal(
      `Pay ${bill.name}`,
      "Record the payment and optionally schedule the same bill for next month.",
      { wide: true },
    );
    const paidDate = field("Payment date", new Date().toISOString().slice(0, 10), "date");
    const cleared = field("Cleared by the bank", "Yes", "select", {
      options: ["Yes", "No"],
    });
    const repeat = field("Add this bill to next month", "No", "select", {
      options: ["No", "Yes"],
    });
    dialog.body.append(
      element(
        "p",
        "lg-callout",
        `Next month’s due date will be ${formatDate(addMonths(bill.due, 1))} when the option is enabled.`,
      ),
      paidDate.wrap,
      cleared.wrap,
      repeat.wrap,
    );
    dialog.actions.append(
      button("Cancel", "lg-button lg-button-secondary", () => closeLayer(dialog.layer)),
      button("Save payment", "lg-button lg-button-primary", () => {
        if (!paidDate.control.value) return showToast("Choose the payment date");
        if (!validateBudgetDate(paidDate.control.value, (value) => { paidDate.control.value = value; }, "payment date")) return;
        const paymentAmount = Number(bill.amount || 0) - getData().transactions.filter(t => String(t.billId) === String(bill.id) && t.type === "expense").reduce((sum,t) => sum + Number(t.amount || 0), 0);
        if (!window.LemonFinance.validTransactionAmount(paymentAmount)) {
          return showToast("The unpaid bill amount must be greater than zero. Review the bill and its payments.");
        }
        const nextDue = addMonths(bill.due, 1);
        updateData((data) => {
          const alreadyScheduled = data.bills.some(
            (entry) =>
              entry.name === bill.name &&
              entry.due === nextDue &&
              String(entry.id) !== String(bill.id),
          );
          const nextBill = {
            ...bill,
            id: Date.now() + 1,
            due: nextDue,
            month: monthFromDate(nextDue),
            status: "upcoming",
          };
          return {
            ...data,
            bills: [
              ...data.bills.map((entry) =>
                String(entry.id) === String(id) ? { ...entry, status: "paid" } : entry,
              ),
              ...(repeat.control.value === "Yes" && !alreadyScheduled ? [nextBill] : []),
            ],
            transactions: [
              {
                id: Date.now(),
                billId: bill.id,
                merchant: bill.name,
                amount: paymentAmount,
                type: "expense",
                category: bill.category || "Other",
                description: `${bill.name} bill`,
                date: paidDate.control.value,
                paidDate: paidDate.control.value,
                dueDate: bill.due,
                cleared: cleared.control.value === "Yes",
                recurring: repeat.control.value === "Yes",
                paymentMethod: "Bill payment",
                month: monthFromDate(paidDate.control.value),
              },
              ...data.transactions,
            ],
          };
        });
        closeLayer(dialog.layer);
        showToast(
          repeat.control.value === "Yes"
            ? "Bill paid and added to next month"
            : "Bill payment recorded",
        );
      }),
    );
  }

  function deleteBill(id) {
    const bill = getData().bills.find((entry) => String(entry.id) === String(id));
    if (!bill) return showToast("That bill is no longer available");
    const dialog = modal("Delete bill?", `${bill.name} · ${formatMoney(bill.amount)}`);
    dialog.body.appendChild(
      element("p", "lg-callout", "This removes the bill but does not remove an already-recorded payment."),
    );
    dialog.actions.append(
      button("Cancel", "lg-button lg-button-secondary", () => closeLayer(dialog.layer)),
      button("Delete bill", "lg-button lg-button-danger", () => {
        updateData((data) => ({
          ...data,
          bills: data.bills.filter((entry) => String(entry.id) !== String(id)),
        }));
        closeLayer(dialog.layer);
        showToast("Bill deleted");
      }),
    );
  }

  function editBill(id) {
    const bill = getData().bills.find((entry) => String(entry.id) === String(id));
    if (!bill) return showToast("That bill is no longer available");
    const dialog = modal("Edit bill", "Update the bill directly without leaving this screen.", {
      wide: true,
    });
    const form = element("div", "lg-form-grid");
    const name = field("Bill name", bill.name);
    const amount = field("Amount", bill.amount, "number", { step: "0.01", min: 0 });
    const due = field("Due date", bill.due, "date");
    const category = field("Category", bill.category || "Other", "select", {
      options: getCategories(),
    });
    const reserved = field("Reserved amount", bill.reserved, "number", { step: "0.01", min: 0 });
    const status = field("Status", bill.status || "upcoming", "select", {
      options: bill.status === "paid" ? ["paid"] : ["upcoming", "due soon", "overdue"],
    });
    [name, amount, due, category, reserved, status].forEach((entry) =>
      form.appendChild(entry.wrap),
    );
    dialog.body.appendChild(form);
    dialog.actions.append(
      button("Delete bill", "lg-button lg-button-danger", () => {
        closeLayer(dialog.layer);
        window.setTimeout(() => deleteBill(id), 0);
      }),
      button("Cancel", "lg-button lg-button-secondary", () => closeLayer(dialog.layer)),
      button("Save changes", "lg-button lg-button-primary", () => {
        if (!name.control.value.trim() || numberValue(amount.control) <= 0 || !due.control.value) {
          return showToast("Add a bill name, amount, and due date first");
        }
        if (!validateBudgetDate(due.control.value, (value) => { due.control.value = value; }, "due date")) return;
        updateData((data) => ({
          ...data,
          bills: data.bills.map((entry) =>
            String(entry.id) === String(id)
              ? {
                  ...entry,
                  name: name.control.value.trim(),
                  amount: numberValue(amount.control),
                  due: due.control.value,
                  month: monthFromDate(due.control.value),
                  category: category.control.value,
                  reserved: numberValue(reserved.control),
                  status: status.control.value,
                }
              : entry,
          ),
        }));
        closeLayer(dialog.layer);
        showToast("Bill updated");
      }),
    );
    name.control.focus();
  }

  function openMemberEditor(id) {
    const existing = getData().household.find((entry) => String(entry.id) === String(id));
    const dialog = modal(existing ? "Edit household member" : "Add household member", "Track each person’s share and payments.", {
      wide: true,
    });
    const form = element("div", "lg-form-grid");
    const name = field("Name", existing?.name || "");
    const rent = field("Rent share", existing?.rent || "", "number", { step: "0.01", min: 0 });
    const utilities = field("Utilities share", existing?.utilities || "", "number", { step: "0.01", min: 0 });
    const other = field("Other shared costs", existing?.other || "", "number", { step: "0.01", min: 0 });
    const paid = field(
      "Paid amount this cycle",
      existing ? memberPaidForCycle(existing) || "" : "",
      "number",
      { step: "0.01", min: 0 },
    );
    [name, rent, utilities, other, paid].forEach((entry) => form.appendChild(entry.wrap));
    dialog.body.appendChild(form);
    if (existing) {
      dialog.actions.append(
        button("Remove member", "lg-button lg-button-danger", () => {
          updateData((data) => ({
            ...data,
            household: data.household.filter((entry) => String(entry.id) !== String(id)),
          }));
          closeLayer(dialog.layer);
          showToast("Household member removed");
        }),
      );
    }
    dialog.actions.append(
      button("Cancel", "lg-button lg-button-secondary", () => closeLayer(dialog.layer)),
      button(existing ? "Save changes" : "Add member", "lg-button lg-button-primary", () => {
        const memberName = name.control.value.trim();
        if (!memberName) return showToast("Enter the member’s name");
        const cyclePaid = numberValue(paid.control);
        const member = {
          ...(existing || {}),
          id: existing?.id || Date.now(),
          name: memberName,
          initial: memberName
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part.charAt(0).toUpperCase())
            .join(""),
          rent: numberValue(rent.control),
          utilities: numberValue(utilities.control),
          other: numberValue(other.control),
          paid: 0,
          paidByCycle: {
            ...(existing?.paidByCycle || {}),
            [currentCycleKey()]: cyclePaid,
          },
        };
        updateData((data) => ({
          ...data,
          household: existing
            ? data.household.map((entry) => (String(entry.id) === String(id) ? member : entry))
            : [...data.household, member],
        }));
        closeLayer(dialog.layer);
        showToast(existing ? "Household member updated" : "Household member added");
      }),
    );
    name.control.focus();
  }

  function recordHouseholdContribution() {
    const household = getData().household;
    if (!household.length) {
      showToast("Add a household member first");
      openMemberEditor();
      return;
    }
    const dialog = modal(
      "Record household contribution",
      "This records money received as income and updates the member’s paid amount.",
      { wide: true },
    );
    const form = element("div", "lg-form-grid");
    const member = field("Member", "", "select", {
      options: ["", ...household.map((entry) => String(entry.id))],
    });
    member.control.options[0].textContent = "Choose member";
    household.forEach((entry, index) => {
      member.control.options[index + 1].textContent = entry.name;
    });
    const amount = field("Amount received", "", "number", { step: "0.01", min: 0 });
    const date = field("Date received", new Date().toISOString().slice(0, 10), "date");
    const cleared = field("Already in the bank", "Yes", "select", {
      options: ["Yes", "No"],
    });
    [member, amount, date, cleared].forEach((entry) => form.appendChild(entry.wrap));
    dialog.body.append(
      element(
        "p",
        "lg-callout",
        "Use this when a household member pays their share. Lemon Glass adds one income transaction, so the contribution becomes part of the rest of your budget.",
      ),
      form,
    );
    dialog.actions.append(
      button("Cancel", "lg-button lg-button-secondary", () => closeLayer(dialog.layer)),
      button("Record contribution", "lg-button lg-button-primary", () => {
        const memberId = member.control.value;
        const paidAmount = numberValue(amount.control);
        const selected = household.find((entry) => String(entry.id) === memberId);
        if (!selected || paidAmount <= 0 || !date.control.value) {
          return showToast("Choose a member, amount, and date first");
        }
        if (!validateBudgetDate(date.control.value, (value) => { date.control.value = value; }, "contribution date")) return;
        updateData((data) => ({
          ...data,
          household: data.household.map((entry) =>
            String(entry.id) === memberId
              ? addMemberPayment(entry, paidAmount, date.control.value)
              : entry,
          ),
          transactions: [
            {
              id: Date.now(),
              householdMemberId: selected.id,
              merchant: selected.name,
              description: "Household contribution toward shared costs",
              amount: paidAmount,
              type: "income",
              category: "Income",
              date: date.control.value,
              month: monthFromDate(date.control.value),
              cleared: cleared.control.value === "Yes",
              recurring: false,
              paymentMethod: "Household transfer",
            },
            ...data.transactions,
          ],
        }));
        closeLayer(dialog.layer);
        showToast("Contribution added to household and transactions");
      }),
    );
  }

  function connectHouseholdToBudget() {
    const dialog = modal(
      "Connect Household to your budget",
      "Household shares are a plan until you record the real money movement.",
      { wide: true },
    );
    const steps = element("div", "lg-help-grid");
    [
      ["1", "Plan each share", "Add a member and enter what they owe for rent, utilities, and other shared costs."],
      ["2", "Record the actual bill once", "Add the full rent or utility charge in Bills. Do not add every member share again as an expense."],
      ["3", "Record contributions", "When someone pays you, record their contribution here. It becomes income and updates Paid so far."],
    ].forEach(([number, title, copy]) => {
      const item = element("div", "lg-help-card");
      item.append(element("span", "lg-step", number), element("strong", "", title), element("p", "", copy));
      steps.appendChild(item);
    });
    dialog.body.append(
      element(
        "p",
        "lg-callout",
        "This keeps the budget accurate: one real expense for the bill, plus an income transaction whenever another person contributes.",
      ),
      steps,
    );
    dialog.actions.append(
      button("Close", "lg-button lg-button-secondary", () => closeLayer(dialog.layer)),
      button("Open Bills", "lg-button lg-button-secondary", () => {
        closeLayer(dialog.layer);
        navigate("Bills");
      }),
      button("Record contribution", "lg-button lg-button-primary", () => {
        closeLayer(dialog.layer);
        recordHouseholdContribution();
      }),
    );
  }

  function recordHouseholdContributionFor(id) {
    const member = getData().household.find((entry) => String(entry.id) === String(id));
    if (!member) return showToast("That household member is no longer available");
    const total =
      Number(member.rent || 0) + Number(member.utilities || 0) + Number(member.other || 0);
    const outstanding = Math.max(0, total - memberPaidForCycle(member));
    if (!outstanding) return showToast(`${member.name} is already paid in full`);
    const dialog = modal(
      `Add ${member.name}’s payment`,
      "Record the full outstanding contribution or choose a partial amount.",
    );
    const date = field("Date received", `${selectedBudgetMonth()}-${String(budgetCycleStartDay()).padStart(2,"0")}`, "date");
    const amount = field("Amount received", outstanding, "number", { step: "0.01", min: 0 });
    dialog.body.append(
      element(
        "p",
        "lg-callout",
        `${member.name} has ${formatMoney(outstanding)} outstanding. This will be recorded as cleared household income.`,
      ),
      amount.wrap,
      date.wrap,
    );
    dialog.actions.append(
      button("Cancel", "lg-button lg-button-secondary", () => closeLayer(dialog.layer)),
      button("Add Payment", "lg-button lg-button-primary", () => {
        const paidAmount = numberValue(amount.control);
        if (paidAmount <= 0 || paidAmount > outstanding) return showToast("Enter an amount up to the outstanding contribution");
        if (!date.control.value) return showToast("Choose the received date");
        if (!validateBudgetDate(date.control.value, (value) => { date.control.value = value; }, "contribution date")) return;
        updateData((data) => ({
          ...data,
          household: data.household.map((entry) =>
            String(entry.id) === String(id)
              ? addMemberPayment(entry, paidAmount, date.control.value)
              : entry,
          ),
          transactions: [
            {
              id: Date.now(),
              householdMemberId: member.id,
              merchant: member.name,
              description: "Household contribution toward shared costs",
              amount: paidAmount,
              type: "income",
              category: "Income",
              date: date.control.value,
              month: monthFromDate(date.control.value),
              cleared: true,
              recurring: false,
              paymentMethod: "Household transfer",
            },
            ...data.transactions,
          ],
        }));
        closeLayer(dialog.layer);
        showToast(`${member.name}’s contribution was added`);
      }),
    );
  }

  function buildHouseholdStatement() {
    const data = getData();
    const container = element("div", "lg-report-content");
    container.appendChild(element("h3", "", "Household statement"));
    const table = element("table", "lg-report-table");
    const head = element("tr");
    ["Member", "Rent", "Utilities", "Other", "Paid", "Outstanding"].forEach((label) =>
      head.appendChild(element("th", "", label)),
    );
    const thead = element("thead");
    thead.appendChild(head);
    const tbody = element("tbody");
    data.household.forEach((member) => {
      const total = member.rent + member.utilities + member.other;
      const paidThisCycle = memberPaidForCycle(member);
      const row = element("tr");
      [
        member.name,
        formatMoney(member.rent),
        formatMoney(member.utilities),
        formatMoney(member.other),
        formatMoney(paidThisCycle),
        formatMoney(Math.max(0, total - paidThisCycle)),
      ].forEach((value) => row.appendChild(element("td", "", value)));
      tbody.appendChild(row);
    });
    table.append(thead, tbody);
    container.appendChild(table);
    if (!data.household.length) container.appendChild(element("p", "lg-empty", "No household members yet."));
    return container;
  }

  function printNode(node, title) {
    const sheet = element("section", "lg-print-sheet");
    sheet.append(element("h1", "", title), element("p", "lg-print-meta", `Lemon Glass · ${formatDate(new Date())}`), node.cloneNode(true));
    document.body.appendChild(sheet);
    document.body.classList.add("lg-printing");
    window.print();
    window.setTimeout(() => {
      document.body.classList.remove("lg-printing");
      sheet.remove();
    }, 1000);
  }

  function householdStatement() {
    const dialog = modal("Household statement", "A printable summary of shared costs and contributions.", {
      wide: true,
    });
    const report = buildHouseholdStatement();
    dialog.body.appendChild(report);
    dialog.actions.append(
      button("Close", "lg-button lg-button-secondary", () => closeLayer(dialog.layer)),
      button("Print / Save PDF", "lg-button lg-button-primary", () => printNode(report, "Household statement")),
    );
  }

  function monthlyReportRows() {
    return window.LemonFinance.report(getData(), accountBudgetStartMonth(), getActiveAccount()?.budgetDuration || 12, budgetCycleStartDay());
  }

  function reportDefinition(type) {
    const data = getData();
    const monthly = monthlyReportRows();
    if (type === "Category spending" || type === "Budget history") {
      const totals = new Map();
      data.transactions
        .filter((entry) => entry.type === "expense")
        .forEach((entry) => totals.set(entry.category, (totals.get(entry.category) || 0) + Number(entry.amount || 0)));
      if (type === "Budget history") {
        Object.values(data.categoryBudgets || {}).forEach((monthBudget) =>
          Object.keys(monthBudget || {}).forEach((category) => {
            if (!totals.has(category)) totals.set(category, 0);
          }),
        );
      }
      return {
        headers: type === "Budget history" ? ["Category", "Actual spending", "Budget assigned"] : ["Category", "Spending"],
        rows: [...totals.entries()].map(([category, total]) => {
          const budgetAssigned = Object.values(data.categoryBudgets || {}).reduce(
            (sum, monthBudget) => sum + Number(monthBudget?.[category] || 0),
            0,
          );
          return type === "Budget history"
            ? [category, formatMoney(total), formatMoney(budgetAssigned)]
            : [category, formatMoney(total)];
        }),
      };
    }
    if (type === "Savings growth") {
      return {
        headers: ["Goal", "Saved", "Target", "Progress"],
        rows: data.goals.map((goal) => [
          goal.name,
          formatMoney(goal.current),
          formatMoney(goal.target),
          `${goal.target ? Math.round((goal.current / goal.target) * 100) : 0}%`,
        ]),
      };
    }
    if (type === "Reserved funds") {
      return {
        headers: ["Reserve", "Purpose", "Amount", "Note"],
        rows: window.LemonFinance.reserveEntries(data, selectedBudgetMonth(), accountBudgetStartMonth(), budgetCycleStartDay()).map((reserve) => [reserve.name, reserve.type, formatMoney(reserve.amount), reserve.note || ""]),
      };
    }
    if (type === "Recurring expenses") {
      return {
        headers: ["Expense", "Category", "Amount", "Schedule", "Status"],
        rows: data.recurring.map((entry) => [
          entry.name,
          entry.category,
          formatMoney(entry.amount),
          `${entry.frequency || "Monthly"}, day ${entry.dueDay}`,
          entry.paused ? "Paused" : "Active",
        ]),
      };
    }
    if (type === "Available history") {
      return {headers:["Month", "Available balance"], rows:monthly.map(entry => [entry.month,formatMoney(entry.available)])};
    }
    return {
      headers: ["Month", "Income", "Expenses", type === "Monthly surplus" ? "Surplus" : "Net cash flow"],
      rows: monthly.map((entry) => [entry.month, formatMoney(entry.income), formatMoney(entry.expenses), formatMoney(entry.net)]),
    };
  }

  function buildReport(type) {
    const definition = reportDefinition(type);
    const report = element("div", "lg-report-content");
    report.appendChild(element("h3", "", type));
    const table = element("table", "lg-report-table");
    const thead = element("thead");
    const header = element("tr");
    definition.headers.forEach((label) => header.appendChild(element("th", "", label)));
    thead.appendChild(header);
    const tbody = element("tbody");
    definition.rows.forEach((values) => {
      const row = element("tr");
      values.forEach((value) => row.appendChild(element("td", "", value)));
      tbody.appendChild(row);
    });
    table.append(thead, tbody);
    report.appendChild(table);
    if (!definition.rows.length) report.appendChild(element("p", "lg-empty", "There is no data for this report yet."));
    return { report, definition };
  }

  function showReport(type = "Cash flow") {
    const dialog = modal(type, `This report uses the active ${budgetYear()} account’s saved data.`, { wide: true });
    const { report, definition } = buildReport(type);
    dialog.body.appendChild(report);
    dialog.actions.append(
      button("Close", "lg-button lg-button-secondary", () => closeLayer(dialog.layer)),
      button("Download CSV", "lg-button lg-button-secondary", () => {
        const csv = [definition.headers, ...definition.rows]
          .map((row) => row.map(csvCell).join(","))
          .join("\r\n");
        download(`lemon-glass-${type.toLowerCase().replaceAll(" ", "-")}.csv`, `\ufeff${csv}`, "text/csv;charset=utf-8");
      }),
      button("Print / Save PDF", "lg-button lg-button-primary", () => printNode(report, type)),
    );
  }

  function exportReport() {
    showReport("Cash flow");
  }

  function showCalendarEvent(type, id) {
    const data = getData();
    const isBill = type === "bill";
    const isRecurring = type === "recurring";
    const event = (isBill ? data.bills : isRecurring ? data.recurring : data.transactions).find(
      (entry) => String(entry.id) === String(id),
    );
    if (!event) return showToast("That calendar event is no longer available");
    const dialog = modal(
      isBill || isRecurring ? event.name : event.merchant,
      isBill ? "Bill details" : isRecurring ? "Recurring payment details" : "Income event details",
      { wide: true },
    );
    const details = element("div", "lg-detail-grid");
    const rows = isBill
      ? [
          ["Amount", formatMoney(event.amount)],
          ["Due date", event.due ? formatDate(event.due) : "Not set"],
          ["Category", event.category || "Other"],
          ["Status", event.status || "Upcoming"],
          ["Reserved", formatMoney(event.reserved)],
        ]
      : isRecurring
        ? [
            ["Amount", formatMoney(event.amount)],
            ["Schedule", `${event.frequency || "Monthly"}, day ${event.dueDay}`],
            ["Category", event.category || "Other"],
            ["Status", event.paused ? "Paused" : "Due this cycle"],
            ["Reserved", event.reserved ? "Yes" : "No"],
          ]
        : [
          ["Amount", formatMoney(event.amount)],
          ["Date", event.date ? formatDate(event.date) : "Not set"],
          ["Category", event.category || "Income"],
          ["Status", event.cleared ? "Cleared" : "Pending"],
          ["Payment method", event.paymentMethod || "Not set"],
        ];
    rows.forEach(([label, value]) => {
      const row = element("div", "lg-detail-row");
      row.append(element("span", "", label), element("strong", "", value));
      details.appendChild(row);
    });
    dialog.body.appendChild(details);
    dialog.actions.append(
      isBill
        ? button("Edit bill", "lg-button lg-button-secondary", () => {
            closeLayer(dialog.layer);
            editBill(id);
          })
        : isRecurring
          ? button("Edit recurring", "lg-button lg-button-secondary", () => {
              closeLayer(dialog.layer);
              editRecurring(id);
            })
        : element("span"),
      button("Close", "lg-button lg-button-primary", () => closeLayer(dialog.layer)),
    );
  }

  function openEventEditor() {
    const dialog = modal("Add calendar event", "Add an income event or a bill to the financial calendar.");
    const type = field("Event type", "Bill", "select", { options: ["Bill", "Income"] });
    const name = field("Name", "");
    const amount = field("Amount", "", "number", { step: "0.01", min: 0 });
    const date = field("Date", "", "date");
    const category = field("Category", "Other", "select", { options: getCategories() });
    category.control.addEventListener("change", () => { if (category.control.value === "Income") type.control.value = "Income"; });
    [type, name, amount, date, category].forEach((entry) => dialog.body.appendChild(entry.wrap));
    dialog.actions.append(
      button("Cancel", "lg-button lg-button-secondary", () => closeLayer(dialog.layer)),
      button("Add event", "lg-button lg-button-primary", () => {
        if (!name.control.value.trim() || numberValue(amount.control) <= 0 || !date.control.value) {
          return showToast("Add a name, amount, and date first");
        }
        if (!validateBudgetDate(date.control.value, (value) => { date.control.value = value; }, "event date")) return;
        const id = Date.now();
        updateData((data) =>
          type.control.value === "Bill"
            ? {
                ...data,
                bills: [
                  ...data.bills,
                  {
                    id,
                    name: name.control.value.trim(),
                    amount: numberValue(amount.control),
                    category: category.control.value,
                    due: date.control.value,
                    month: monthFromDate(date.control.value),
                    reserved: 0,
                    status: "upcoming",
                  },
                ],
              }
            : {
                ...data,
                transactions: [
                  {
                    id,
                    merchant: name.control.value.trim(),
                    description: "Calendar income event",
                    amount: numberValue(amount.control),
                    type: "income",
                    category: category.control.value,
                    date: date.control.value,
                    month: monthFromDate(date.control.value),
                    cleared: false,
                    recurring: false,
                    paymentMethod: "Scheduled",
                  },
                  ...data.transactions,
                ],
              },
        );
        closeLayer(dialog.layer);
        showToast("Calendar event added");
      }),
    );
    name.control.focus();
  }

  function applyCalendarFilters() {
    const filters = readJson(FILTERS_KEY, { bills: true, income: true, recurring: true });
    document.querySelectorAll(".cal-event").forEach((event) => {
      const isIncome = event.classList.contains("green");
      const isRecurring = event.classList.contains("recurring");
      event.hidden = isRecurring ? !filters.recurring : isIncome ? !filters.income : !filters.bills;
    });
  }

  function filterEvents() {
    const current = readJson(FILTERS_KEY, { bills: true, income: true, recurring: true });
    const dialog = modal("Filter calendar events", "Choose which event types appear in the calendar.");
    const bills = field("Show bills", current.bills ? "Yes" : "No", "select", { options: ["Yes", "No"] });
    const income = field("Show income", current.income ? "Yes" : "No", "select", { options: ["Yes", "No"] });
    const recurring = field("Show recurring", current.recurring !== false ? "Yes" : "No", "select", { options: ["Yes", "No"] });
    dialog.body.append(bills.wrap, income.wrap, recurring.wrap);
    dialog.actions.append(
      button("Cancel", "lg-button lg-button-secondary", () => closeLayer(dialog.layer)),
      button("Apply filters", "lg-button lg-button-primary", () => {
        writeJson(FILTERS_KEY, {
          bills: bills.control.value === "Yes",
          income: income.control.value === "Yes",
          recurring: recurring.control.value === "Yes",
        });
        applyCalendarFilters();
        closeLayer(dialog.layer);
        showToast("Calendar filters applied");
      }),
    );
  }

  async function digest(value) {
    const bytes = new TextEncoder().encode(value);
    const hash = await window.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function showLockScreen() {
    if (!preference("app-lock", false) || !window.localStorage.getItem(PASSCODE_KEY)) return;
    const dialog = modal("Lemon Glass is locked", "Enter your passcode to continue.", {
      dismissible: false,
    });
    dialog.layer.classList.add("lg-lock-layer");
    const passcode = field("Passcode", "", "password", { placeholder: "Enter passcode" });
    const error = element("p", "lg-error");
    dialog.body.append(passcode.wrap, error);
    dialog.actions.append(
      button("Unlock", "lg-button lg-button-primary", async () => {
        const expected = window.localStorage.getItem(PASSCODE_KEY);
        if ((await digest(passcode.control.value)) !== expected) {
          error.textContent = "That passcode is not correct.";
          passcode.control.select();
          return;
        }
        closeLayer(dialog.layer);
        resetIdleTimer();
      }),
    );
    passcode.control.addEventListener("keydown", (event) => {
      if (event.key === "Enter") dialog.actions.querySelector("button")?.click();
    });
    window.setTimeout(() => passcode.control.focus(), 0);
  }

  function configureAppLock(turnOn, toggle) {
    if (!turnOn) {
      setPreference("app-lock", false);
      window.localStorage.removeItem(PASSCODE_KEY);
      toggle.classList.remove("on");
      toggle.setAttribute("aria-pressed", "false");
      toggle.setAttribute("aria-label", "App lock: off");
      showToast("App lock turned off");
      return;
    }
    const dialog = modal("Set an app-lock passcode", "Use at least four characters. The passcode stays on this device.");
    const passcode = field("New passcode", "", "password", { placeholder: "At least 4 characters" });
    const confirm = field("Confirm passcode", "", "password", { placeholder: "Repeat passcode" });
    const error = element("p", "lg-error");
    dialog.body.append(passcode.wrap, confirm.wrap, error);
    dialog.actions.append(
      button("Cancel", "lg-button lg-button-secondary", () => {
        toggle.classList.remove("on");
        closeLayer(dialog.layer);
      }),
      button("Enable app lock", "lg-button lg-button-primary", async () => {
        if (passcode.control.value.length < 4) {
          error.textContent = "Use at least four characters.";
          return;
        }
        if (passcode.control.value !== confirm.control.value) {
          error.textContent = "The passcodes do not match.";
          return;
        }
        window.localStorage.setItem(PASSCODE_KEY, await digest(passcode.control.value));
        setPreference("app-lock", true);
        toggle.classList.add("on");
        toggle.setAttribute("aria-pressed", "true");
        toggle.setAttribute("aria-label", "App lock: on");
        closeLayer(dialog.layer);
        resetIdleTimer();
        showToast("App lock enabled");
      }),
    );
    passcode.control.focus();
  }

  let idleTimer = 0;
  function resetIdleTimer() {
    window.clearTimeout(idleTimer);
    if (preference("app-lock", false) && window.localStorage.getItem(PASSCODE_KEY)) {
      idleTimer = window.setTimeout(showLockScreen, 5 * 60 * 1000);
    }
  }

  const settingKey = (label) =>
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const profileFieldKey = (label) =>
    ({
      "Display name": "displayName",
      Email: "email",
      Currency: "currency",
      Locale: "locale",
      "Time zone": "timeZone",
    })[label];

  function profileControls() {
    const controls = {};
    document
      .querySelectorAll(".settings-grid > .card:last-child .form-field")
      .forEach((wrap) => {
        const key = profileFieldKey(wrap.querySelector("label")?.textContent.trim());
        const control = wrap.querySelector("input, select");
        if (key && control) controls[key] = control;
      });
    return controls;
  }

  function syncProfile() {
    const saved = readJson(PROFILE_KEY, {});
    Object.entries(profileControls()).forEach(([key, control]) => {
      if (control.dataset.lemonGlassProfileBound) return;
      if (Object.hasOwn(saved, key)) control.value = saved[key] || "";
      control.dataset.lemonGlassProfileBound = "true";
    });
  }

  function saveProfile(notify = true) {
    const controls = profileControls();
    if (!Object.keys(controls).length) return false;
    const profile = {};
    Object.entries(controls).forEach(([key, control]) => {
      profile[key] = control.value.trim();
    });
    writeJson(PROFILE_KEY, profile);
    if (notify) showToast("Profile and preferences saved");
    return true;
  }

  function settingsContentTitle() {
    return document
      .querySelector(".settings-grid > .card:last-child .card-head h2")
      ?.textContent.trim();
  }

  function createSettingsControl(label, control) {
    const wrap = element("div", "form-field");
    wrap.append(element("label", "", label), control);
    return wrap;
  }

  function ensureThemePicker() {
    if (settingsContentTitle() !== "Profile & preferences") return;
    const content = document.querySelector(".settings-grid > .card:last-child");
    if (!content || content.querySelector("#lg-color-scheme")) return;
    const select = element("select");
    select.id = "lg-color-scheme";
    themeOptions.forEach(([value, label]) => {
      const option = element("option", "", label);
      option.value = value;
      select.appendChild(option);
    });
    select.value = applyTheme();
    select.addEventListener("change", () => {
      applyTheme(select.value);
      showToast(`${select.selectedOptions[0].textContent} theme applied`);
    });
    const row = element("div", "form-row lg-injected-settings lg-theme-settings");
    const timeZone = element("select");
    timeZone.id = "lg-time-zone";
    const detectedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Berlin";
    [...new Set([detectedTimeZone, "Europe/Berlin", "Europe/London", "Europe/Paris", "Europe/Madrid", "Europe/Rome", "Europe/Amsterdam"])].forEach((value) => {
      const option = element("option", "", value);
      option.value = value;
      timeZone.appendChild(option);
    });
    timeZone.value = readJson(PROFILE_KEY, {}).timeZone || detectedTimeZone;
    row.append(
      createSettingsControl("Color scheme", select),
      createSettingsControl("Time zone", timeZone),
    );
    content.insertBefore(row, content.querySelector(".setting-line"));
  }

  function ensureBudgetCycleControl() {
    if (settingsContentTitle() !== "Budget configuration") return;
    const content = document.querySelector(".settings-grid > .card:last-child");
    const row = content?.querySelector(".form-row");
    if (!row || row.querySelector("#lg-budget-cycle-start")) return;
    const input = element("input");
    input.id = "lg-budget-cycle-start";
    input.type = "number";
    input.min = "1";
    input.max = "28";
    input.step = "1";
    input.value = String(budgetCycleStartDay());
    const cycleControl = createSettingsControl("Budget cycle start day", input);
    cycleControl.classList.add("lg-budget-settings");
    row.appendChild(cycleControl);
    const note = element(
      "p",
      "lg-setting-note lg-budget-settings",
      "With day 6 selected, every budget cycle runs from the 6th through the 5th of the following month.",
    );
    const reminderLine = element("div", "setting-line lg-injected-settings lg-budget-settings");
    const reminderCopy = element("div");
    reminderCopy.append(
      element("strong", "", "Year-end rollover reminder"),
      element("p", "", "Offer to archive this worksheet and begin the next year with its remaining balance."),
    );
    const reminderToggle = button("", "toggle", null);
    reminderToggle.classList.toggle("on", preference("year-end-rollover-reminder", true));
    reminderLine.append(reminderCopy, reminderToggle);
    const rolloverButton = button("Start next year worksheet", "text-btn lg-rollover-button lg-budget-settings", () => {
      window.LemonGlassAccounts?.rollover?.();
    });
    rolloverButton.prepend(element("span", "", "↗ "));
    row.after(note, reminderLine, rolloverButton);
  }

  function syncBudgetSettings() {
    if (settingsContentTitle() !== "Budget configuration") return;
    const fields = Array.from(
      document.querySelectorAll(".settings-grid > .card:last-child .form-field"),
    );
    const controlFor = (label) =>
      fields
        .find((wrap) => wrap.querySelector("label")?.textContent.trim() === label)
        ?.querySelector("input, select");
    const year = controlFor("Budget year");
    const opening = controlFor("Opening bank balance");
    const cycle = controlFor("Budget cycle start day");
    if (year && !year.dataset.lemonGlassBound) {
      year.value = String(budgetYear());
      year.dataset.lemonGlassBound = "true";
    }
    if (opening && !opening.dataset.lemonGlassBound) {
      opening.value = String(getData().transactions.filter(window.LemonFinance.opening).reduce((sum, entry) => sum + Number(entry.amount || 0), Number(getData().openingBalance || 0)));
      opening.dataset.lemonGlassBound = "true";
    }
    if (cycle && !cycle.dataset.lemonGlassBound) {
      cycle.value = String(budgetCycleStartDay());
      cycle.dataset.lemonGlassBound = "true";
    }
  }

  function saveCurrentSettings() {
    const title = settingsContentTitle();
    if (title === "Profile & preferences") {
      saveProfile(false);
      const theme = document.querySelector("#lg-color-scheme")?.value;
      if (theme) applyTheme(theme);
      showToast("Profile and preferences saved");
      return true;
    }
    if (title === "Budget configuration") {
      const fields = Array.from(
        document.querySelectorAll(".settings-grid > .card:last-child .form-field"),
      );
      const controlFor = (label) =>
        fields
          .find((wrap) => wrap.querySelector("label")?.textContent.trim() === label)
          ?.querySelector("input, select");
      const year = Number(controlFor("Budget year")?.value) || budgetYear();
      const opening = Number(
        String(controlFor("Opening bank balance")?.value || "0").replace(",", "."),
      );
      const startDay = Math.min(
        28,
        Math.max(1, Math.round(Number(controlFor("Budget cycle start day")?.value) || 6)),
      );
      setPreferenceValue("budget-year", String(year));
      const activeAccount = getActiveAccount();
      if (activeAccount) {
        writeJson(
          ACCOUNTS_KEY,
          getAccounts().map((account) =>
            account.id === activeAccount.id ? { ...account, year } : account,
          ),
        );
      }
      setPreferenceValue("budget-cycle-start-day", startDay);
      updateData((data) => ({
        ...data,
        openingBalance: 0,
        transactions: [
          ...(opening ? [{ id: "opening-" + getActiveAccount().id, merchant: "Opening Balance", description: "Opening balance", amount: opening, type: "income", category: "Income", date: accountBudgetStartMonth() + "-01", openingMonth: accountBudgetStartMonth(), openingBalanceEntry: true, paymentMethod: "Opening balance", cleared: true }] : []),
          ...data.transactions.filter(entry => !window.LemonFinance.opening(entry))
        ],
      }));
      window.dispatchEvent(
        new CustomEvent("lemon-glass:cycle-change", { detail: { startDay } }),
      );
      showToast(`Budget cycle saved · day ${startDay} through day ${startDay - 1 || 31}`);
      return true;
    }
    showToast("Settings saved");
    return true;
  }

  function freshStart() {
    const account = getActiveAccount();
    if (!account) return showToast("Create an account before starting fresh");
    const trigger = document.activeElement;
    const dialog = modal("Start fresh?", `Give ${account.name} a clean page.`, { wide: true });
    dialog.panel.setAttribute("aria-label", "Start fresh?");
    dialog.body.appendChild(element("p", "lg-callout",
      `This clears all financial data in ${account.name}: opening balance, transactions, bills, savings goals, Money Reserve, recurring items, household information and category budgets. Your account name, budget period, preferences and other accounts stay as they are.`));
    let finished = false;
    const dismiss = () => {
      finished = true;
      closeLayer(dialog.layer);
      trigger?.focus();
    };
    const cancel = button("Keep my account", "lg-button lg-button-secondary", dismiss);
    const confirm = button("Start fresh", "lg-button lg-button-danger", () => {
      if (finished) return;
      if (getActiveAccount()?.id !== account.id) {
        return showToast("The active account changed. Close this window and start again from the account you want to reset.");
      }
      const key = accountDataKey(account.id);
      const next = emptyData();
      try {
        // Keep the exact saved data, including any legacy entries, for recovery.
        const previous = window.localStorage.getItem(key) || JSON.stringify(emptyData());
        let stamp = Date.now();
        while (window.localStorage.getItem(`${key}.before-fresh-start.${stamp}`) !== null) stamp += 1;
        window.localStorage.setItem(`${key}.before-fresh-start.${stamp}`, previous);
        writeJson(key, next);
      } catch {
        return showToast("Fresh Start could not be saved. Your account has not been reset. Please try again.");
      }
      finished = true;
      window.dispatchEvent(new CustomEvent("lemon-glass:data-change", { detail: { data: next } }));
      closeLayer(dialog.layer);
      trigger?.focus();
      showToast(`${account.name} is ready for a fresh start`);
    });
    dialog.actions.append(cancel, confirm);
    dialog.layer.addEventListener("keydown", event => {
      if (event.key === "Escape") { event.preventDefault(); dismiss(); }
    });
    cancel.focus();
  }

  function saveNow() {
    const account = getActiveAccount();
    if (!account) return false;
    writeJson(accountDataKey(account.id), getData());
    window.localStorage.setItem("lemon-glass.last-saved-at", new Date().toISOString());
    return true;
  }

  function syncSettings() {
    const activeTitle = settingsContentTitle();
    if (activeTitle !== "Profile & preferences") {
      document.querySelectorAll(".lg-theme-settings").forEach((node) => node.remove());
    }
    if (activeTitle !== "Budget configuration") {
      document.querySelectorAll(".lg-budget-settings").forEach((node) => node.remove());
    }
    ensureThemePicker();
    ensureBudgetCycleControl();
    document.querySelectorAll(".settings-grid > .card:last-child .setting-line").forEach((line) => {
      const toggle = line.querySelector("button.toggle");
      const label = line.querySelector("strong")?.textContent.trim();
      if (!toggle || !label) return;
      const key = settingKey(label);
      const active =
        key === "app-lock" && !window.localStorage.getItem(PASSCODE_KEY)
          ? false
          : preference(key, toggle.classList.contains("on"));
      toggle.classList.toggle("on", active);
      toggle.setAttribute("aria-pressed", String(active));
      toggle.setAttribute("aria-label", `${label}: ${active ? "on" : "off"}`);
    });
    syncProfile();
    syncBudgetSettings();
    applyCalendarFilters();
  }

  function handleToggleClick(toggle) {
    const line = toggle.closest(".setting-line");
    const label = line?.querySelector("strong")?.textContent.trim();
    if (!label) return;
    const key = settingKey(label);
    const next = !toggle.classList.contains("on");
    if (key === "app-lock") {
      configureAppLock(next, toggle);
      return;
    }
    toggle.classList.toggle("on", next);
    toggle.setAttribute("aria-pressed", String(next));
    toggle.setAttribute("aria-label", `${label}: ${next ? "on" : "off"}`);
    setPreference(key, next);
    showToast(`${label} ${next ? "enabled" : "disabled"}`);
  }

  function clickHandler(event) {
    const action = event.target.closest("button");
    if (
      action?.textContent.trim().includes("Save changes") &&
      document.querySelector(".settings-grid") &&
      saveCurrentSettings()
    ) {
      event.preventDefault();
      return;
    }
    const toggle = event.target.closest(".settings-grid > .card:last-child button.toggle");
    if (toggle) {
      event.preventDefault();
      handleToggleClick(toggle);
      return;
    }
  }

  function initialize() {
    applyTheme();
    document.addEventListener("click", clickHandler, true);
    ["mousemove", "keydown", "mousedown", "touchstart"].forEach((name) =>
      document.addEventListener(name, resetIdleTimer, { passive: true }),
    );
    const observer = new MutationObserver(syncSettings);
    observer.observe(document.getElementById("root") || document.body, { childList: true, subtree: true });
    syncSettings();
    window.addEventListener("beforeunload", saveNow);
    window.addEventListener("pagehide", saveNow);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") saveNow();
    });
    window.addEventListener("lemon-glass:data-change", (event) => {
      window.setTimeout(() => validateCurrentMonth(event.detail?.data || getData()), 80);
    });
    window.setTimeout(() => validateCurrentMonth(), 350);
    if (preference("app-lock", false)) showLockScreen();
    else resetIdleTimer();
  }

  window.LemonGlass = {
    addRecurring,
    addCategory,
    applyTheme,
    backupData,
    loadBackup,
    budgetCycleStartDay,
    configureBudget,
    budgetYear,
    deleteBill,
    deleteTransaction,
    editCategory,
    editBill,
    editGoal,
    editRecurring,
    editTransaction,
    exportReport,
    exportTransactions,
    filterEvents,
    formatDate,
    formatMoney,
    getCategoryBudgets,
    getCategories,
    connectHouseholdToBudget,
    householdStatement,
    manageGoals,
    moneyAsideHelp,
    navigate,
    openCategoriesPage,
    openEventEditor,
    openMemberEditor,
    payBill,
    payRecurring,
    preference,
    recordHouseholdContribution,
    recordHouseholdContributionFor,
    releaseReserve,
    contributeSavings,
    saveProfile,
    saveNow,
    freshStart,
    setSelectedBudgetMonth,
    showCalendarEvent,
    showReport,
    showSchedule,
    validateCurrentMonth,
    validateBudgetDate,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
