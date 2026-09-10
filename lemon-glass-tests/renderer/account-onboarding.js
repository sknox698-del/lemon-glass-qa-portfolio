(function () {
  "use strict";

  const ACCOUNTS_KEY = "avera.accounts.v1";
  const ACTIVE_ACCOUNT_KEY = "avera.active-account.v1";
  const PREFERENCES_KEY = "lemon-glass.preferences.v1";
  const accountDataKey = (id) => `avera.account.${id}.data.v1`;
  const tutorialKey = (id) => `avera.tutorial.${id}.v1`;

  const readJson = (key, fallback) => {
    try {
      const value = JSON.parse(window.localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  };

  const getAccounts = () => {
    const accounts = readJson(ACCOUNTS_KEY, []);
    return Array.isArray(accounts) ? accounts : [];
  };

  const saveAccounts = (accounts) =>
    window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));

  const getActiveAccount = () => {
    const accounts = getAccounts();
    const activeId = window.localStorage.getItem(ACTIVE_ACCOUNT_KEY);
    return accounts.find((account) => account.id === activeId) || accounts[0] || null;
  };

  const makeId = () => {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `account-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const parseBalance = (value) => {
    const raw = String(value || "").trim().replace(/\s/g, "").replace(/€/g, "");
    const normalized = raw.includes(",")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw;
    const amount = Number(normalized);
    return Number.isFinite(amount) ? amount : 0;
  };

  const emptyAccountData = (openingBalance = 0, openingDate = "") => ({
    openingBalance: 0,
    categoryBudgets: {},
    transactions: openingBalance
      ? [{
          id: nextId("opening"),
          merchant: "Opening Balance",
          description: "Opening balance",
          openingBalanceEntry: true,
          openingMonth: openingDate.slice(0, 7),
          amount: Number(openingBalance) || 0,
          type: "income",
          category: "Income",
          date: openingDate || new Date().toISOString().slice(0, 10),
          cleared: true,
          recurring: false,
          paymentMethod: "Opening balance",
        }]
      : [],
    bills: [],
    reserves: [],
    goals: [],
    recurring: [],
    household: [],
  });

  const getAccountData = (id) => ({
    ...emptyAccountData(0),
    ...readJson(accountDataKey(id), emptyAccountData(0)),
  });

  const saveAccountData = (id, data) =>
    window.localStorage.setItem(accountDataKey(id), JSON.stringify(data));

  const formatMoney = (value) =>
    new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" })
      .format(Number(value) || 0)
      .replace(/\s+(?=€)/, "");

  const formatDate = (date) =>
    `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;

  const shiftYear = (value, years = 1) => {
    if (!value) return value;
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    date.setFullYear(date.getFullYear() + years);
    return date.toISOString().slice(0, 10);
  };

  const nextId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const icon = (symbol) => {
    const node = element("span", "av-symbol", symbol);
    node.setAttribute("aria-hidden", "true");
    return node;
  };

  function closeLayer(layer) {
    if (!layer) return;
    layer.classList.add("av-layer-closing");
    window.setTimeout(() => layer.remove(), 160);
  }

  function createLayer({ dismissible = true, className = "" } = {}) {
    document.querySelectorAll(".av-layer").forEach((layer) => layer.remove());
    const layer = element("div", `av-layer ${className}`.trim());
    if (dismissible) {
      layer.addEventListener("mousedown", (event) => {
        if (event.target === layer) closeLayer(layer);
      });
    }
    document.body.appendChild(layer);
    return layer;
  }

  function createCloseButton(layer) {
    const close = element("button", "av-icon-button", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Close");
    close.addEventListener("click", () => closeLayer(layer));
    return close;
  }

  function accountInitial(name) {
    return String(name || "A").trim().charAt(0).toUpperCase() || "A";
  }

  function createAccountSwitcher() {
    const active = getActiveAccount();
    const button = element("button", "av-account-switcher");
    button.type = "button";
    button.id = "av-account-switcher";
    button.appendChild(element("span", "av-account-initial", accountInitial(active?.name)));

    const copy = element("span", "av-account-copy");
    copy.appendChild(
      element("strong", "", active ? active.name : "Create an account"),
    );
    copy.appendChild(
      element(
        "small",
        "",
        active
          ? `${active.type || "Account"} · ${active.year || new Date().getFullYear()}`
          : "Start here",
      ),
    );
    button.appendChild(copy);
    button.appendChild(icon("⌄"));
    button.addEventListener("click", openAccountManager);
    return button;
  }

  function attachAccountSwitcher() {
    if (document.getElementById("av-account-switcher")) return true;
    const brand = document.querySelector(".sidebar .brand") || document.querySelector(".brand");
    if (!brand || !brand.parentElement) return false;
    brand.insertAdjacentElement("afterend", createAccountSwitcher());
    return true;
  }

  function openAccountManager() {
    const layer = createLayer({ dismissible: true, className: "av-manager-layer" });
    const panel = element("section", "av-account-manager av-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "av-manager-title");

    const header = element("div", "av-panel-header");
    const heading = element("div");
    const eyebrow = element("span", "av-eyebrow", "Your workspace");
    const title = element("h2", "", "Accounts");
    title.id = "av-manager-title";
    heading.append(eyebrow, title);
    header.append(heading, createCloseButton(layer));
    panel.appendChild(header);
    panel.appendChild(
      element(
        "p",
        "av-panel-intro",
        "Each named account keeps its own transactions, bills, goals, and reserved money.",
      ),
    );

    const list = element("div", "av-account-list");
    const active = getActiveAccount();
    getAccounts().forEach((account) => {
      const row = element("div", "av-account-row");
      if (account.id === active?.id) row.classList.add("is-active");
      const select = element("button", "av-account-select");
      select.type = "button";
      select.appendChild(element("span", "av-account-initial", accountInitial(account.name)));
      const copy = element("span", "av-account-copy");
      copy.appendChild(element("strong", "", account.name));
      copy.appendChild(
        element("small", "", `${account.type || "Account"} · ${account.year || new Date().getFullYear()}`),
      );
      select.appendChild(copy);
      select.appendChild(
        element(
          "span",
          "av-account-status",
          account.id === active?.id ? "Active" : "Switch",
        ),
      );
      select.addEventListener("click", () => {
        if (account.id === active?.id) {
          closeLayer(layer);
          return;
        }
        window.localStorage.setItem(ACTIVE_ACCOUNT_KEY, account.id);
        window.location.reload();
      });
      const actions = element("div", "av-account-actions");
      const edit = element("button", "av-mini-button", "Edit");
      edit.type = "button";
      edit.addEventListener("click", () => {
        closeLayer(layer);
        window.setTimeout(() => openEditAccount(account.id), 170);
      });
      const remove = element("button", "av-mini-button av-danger-button", "Delete");
      remove.type = "button";
      remove.addEventListener("click", () => {
        closeLayer(layer);
        window.setTimeout(() => openDeleteAccount(account.id), 170);
      });
      actions.append(edit, remove);
      row.append(select, actions);
      list.appendChild(row);
    });
    panel.appendChild(list);

    const add = element("button", "av-primary-button", "＋ Add another account");
    add.type = "button";
    add.addEventListener("click", () => {
      closeLayer(layer);
      window.setTimeout(() => openAccountWizard(false), 170);
    });
    panel.appendChild(add);
    layer.appendChild(panel);
    window.setTimeout(() => panel.focus(), 0);
  }

  function openEditAccount(id) {
    const account = getAccounts().find((entry) => entry.id === id);
    if (!account) return;
    const layer = createLayer({ dismissible: true, className: "av-manager-layer" });
    const panel = element("section", "av-account-manager av-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.tabIndex = -1;
    const header = element("div", "av-panel-header");
    const heading = element("div");
    heading.append(element("span", "av-eyebrow", "Account settings"), element("h2", "", "Edit account"));
    header.append(heading, createCloseButton(layer));
    const form = element("div", "av-account-form");
    const nameField = element("label", "av-field");
    nameField.appendChild(element("span", "", "Account name"));
    const name = element("input");
    name.value = account.name || "";
    name.autocomplete = "off";
    nameField.appendChild(name);
    const typeField = element("label", "av-field");
    typeField.appendChild(element("span", "", "Account type"));
    const type = element("select");
    ["", "Checking", "Savings", "Cash", "Credit"].forEach((value) => {
      const option = element("option", "", value || "Choose an account type");
      option.value = value;
      type.appendChild(option);
    });
    type.value = account.type || "";
    typeField.appendChild(type);
    const yearField = element("label", "av-field");
    yearField.appendChild(element("span", "", "Worksheet year"));
    const year = element("input");
    year.type = "number";
    year.min = "2000";
    year.max = "2200";
    year.value = String(account.year || new Date().getFullYear());
    yearField.appendChild(year);
    const error = element("p", "av-form-error");
    form.append(nameField, typeField, yearField, error);
    const actions = element("div", "av-wizard-actions");
    const cancel = element("button", "av-secondary-button", "Cancel");
    cancel.type = "button";
    cancel.addEventListener("click", () => closeLayer(layer));
    const save = element("button", "av-primary-button", "Save account");
    save.type = "button";
    save.addEventListener("click", () => {
      const nextYear = Math.round(Number(year.value));
      if (!name.value.trim()) {
        error.textContent = "Please give this account a name.";
        name.focus();
        return;
      }
      if (nextYear < 2000 || nextYear > 2200) {
        error.textContent = "Enter a valid worksheet year.";
        year.focus();
        return;
      }
      saveAccounts(
        getAccounts().map((entry) =>
          entry.id === id
            ? { ...entry, name: name.value.trim(), type: type.value, year: nextYear }
            : entry,
        ),
      );
      const preferences = readJson(PREFERENCES_KEY, {});
      window.localStorage.setItem(
        PREFERENCES_KEY,
        JSON.stringify({ ...preferences, "budget-year": String(nextYear) }),
      );
      window.location.reload();
    });
    actions.append(cancel, save);
    panel.append(header, element("p", "av-panel-intro", "Rename this account or correct its worksheet year."), form, actions);
    layer.appendChild(panel);
    window.setTimeout(() => name.focus(), 0);
  }

  function openDeleteAccount(id) {
    const account = getAccounts().find((entry) => entry.id === id);
    if (!account) return;
    const layer = createLayer({ dismissible: true, className: "av-manager-layer" });
    const panel = element("section", "av-account-manager av-panel av-confirm-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    const header = element("div", "av-panel-header");
    const heading = element("div");
    heading.append(element("span", "av-eyebrow", "Remove account"), element("h2", "", `Delete ${account.name}?`));
    header.append(heading, createCloseButton(layer));
    panel.append(
      header,
      element(
        "p",
        "av-panel-intro",
        "This permanently removes this account and all of its transactions, bills, goals, reserves, and household information.",
      ),
    );
    const actions = element("div", "av-wizard-actions");
    const cancel = element("button", "av-secondary-button", "Keep account");
    cancel.type = "button";
    cancel.addEventListener("click", () => closeLayer(layer));
    const remove = element("button", "av-primary-button av-danger-button", "Delete account");
    remove.type = "button";
    remove.addEventListener("click", () => {
      const remaining = getAccounts().filter((entry) => entry.id !== id);
      saveAccounts(remaining);
      window.localStorage.removeItem(accountDataKey(id));
      window.localStorage.removeItem(tutorialKey(id));
      Object.keys(window.localStorage)
        .filter((key) => key.startsWith(`lemon-glass.year-rollover.${id}.`))
        .forEach((key) => window.localStorage.removeItem(key));
      if (window.localStorage.getItem(ACTIVE_ACCOUNT_KEY) === id) {
        if (remaining.length) window.localStorage.setItem(ACTIVE_ACCOUNT_KEY, remaining[0].id);
        else window.localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
      }
      window.location.reload();
    });
    actions.append(cancel, remove);
    panel.appendChild(actions);
    layer.appendChild(panel);
  }

  function openYearRollover() {
    const account = getActiveAccount();
    if (!account) return;
    const accountYear = Number(account.year || new Date().getFullYear());
    const nextYear = accountYear + 1;
    const existing = getAccounts().find(
      (entry) => entry.rolledFrom === account.id && Number(entry.year) === nextYear,
    );
    if (existing) {
      window.localStorage.setItem(ACTIVE_ACCOUNT_KEY, existing.id);
      window.location.reload();
      return;
    }
    const data = getAccountData(account.id);
    const closingBalance = data.transactions.reduce(
      (balance, transaction) =>
        transaction.cleared
          ? balance +
            (transaction.type === "income"
              ? Number(transaction.amount || 0)
              : transaction.type === "expense"
                ? -Number(transaction.amount || 0)
                : 0)
          : balance,
      Number(data.openingBalance || 0),
    );
    const layer = createLayer({ dismissible: true, className: "av-manager-layer" });
    const panel = element("section", "av-account-manager av-panel av-rollover-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    const header = element("div", "av-panel-header");
    const heading = element("div");
    heading.append(element("span", "av-eyebrow", `${accountYear} year-end`), element("h2", "", "Start the next yearly worksheet"));
    header.append(heading, createCloseButton(layer));
    const intro = element(
      "p",
      "av-panel-intro",
      `Your ${accountYear} account will remain saved. Lemon Glass will create a clean ${nextYear} worksheet with ${formatMoney(closingBalance)} carried forward.`,
    );
    const form = element("div", "av-account-form");
    const nameField = element("label", "av-field");
    nameField.appendChild(element("span", "", "New worksheet name"));
    const name = element("input");
    name.value = `${account.name} ${nextYear}`;
    name.autocomplete = "off";
    nameField.appendChild(name);
    const yearField = element("label", "av-field");
    yearField.appendChild(element("span", "", "Worksheet year"));
    const year = element("input");
    year.type = "number";
    year.value = String(nextYear);
    year.readOnly = true;
    yearField.appendChild(year);
    const carryField = element("label", "av-field");
    carryField.appendChild(element("span", "", "Carry planning information forward"));
    const carry = element("select");
    [
      ["yes", "Yes — categories, budgets, bills, goals, recurring costs, reserves, and household"],
      ["no", "No — opening balance only"],
    ].forEach(([value, label]) => {
      const option = element("option", "", label);
      option.value = value;
      carry.appendChild(option);
    });
    carryField.appendChild(carry);
    const error = element("p", "av-form-error");
    form.append(nameField, yearField, carryField, error);
    const summary = element("div", "av-rollover-summary");
    [
      ["Saved worksheet", `${account.name} · ${accountYear}`],
      ["Next worksheet", String(nextYear)],
      ["Balance carried", formatMoney(closingBalance)],
      ["Created", formatDate(new Date())],
    ].forEach(([label, value]) => {
      const item = element("div");
      item.append(element("small", "", label), element("strong", "", value));
      summary.appendChild(item);
    });
    const actions = element("div", "av-wizard-actions");
    const later = element("button", "av-secondary-button", "Remind me later");
    later.type = "button";
    later.addEventListener("click", () => {
      window.localStorage.removeItem(`lemon-glass.year-rollover.${account.id}.${accountYear}`);
      closeLayer(layer);
    });
    const create = element("button", "av-primary-button", `Start ${nextYear}`);
    create.type = "button";
    create.addEventListener("click", () => {
      if (!name.value.trim()) {
        error.textContent = "Please name the new worksheet.";
        name.focus();
        return;
      }
      const newAccountId = makeId();
      const copyPlanning = carry.value === "yes";
      const nextStartMonth = `${nextYear}-01`;
      const nextData = emptyAccountData(closingBalance, `${nextStartMonth}-01`);
      if (copyPlanning) {
        nextData.categoryBudgets = { ...(data.categoryBudgets || {}) };
        nextData.bills = (data.bills || []).map((bill) => ({
          ...bill,
          id: nextId("bill"),
          due: shiftYear(bill.due),
          month: bill.month,
          status: "upcoming",
        }));
        const goalIds = new Map((data.goals || []).map(goal => [String(goal.id), nextId("goal")]));
        nextData.goals = (data.goals || []).map((goal) => ({
          ...goal,
          id: goalIds.get(String(goal.id)),
          targetDate: shiftYear(goal.targetDate),
        }));
        nextData.recurring = (data.recurring || []).map((entry) => ({
          ...entry,
          id: nextId("recurring"),
        }));
        nextData.reserves = (data.reserves || []).map((reserve) => ({
          ...reserve,
          id: nextId("reserve"),
          ...(reserve.goalId != null && goalIds.has(String(reserve.goalId)) ? {goalId:goalIds.get(String(reserve.goalId)), reservedAt:shiftYear(reserve.reservedAt)} : {}),
          release: shiftYear(reserve.release),
        }));
        nextData.household = (data.household || []).map((member) => ({
          ...member,
          id: nextId("member"),
          paid: 0,
        }));
      }
      const nextAccount = {
        id: newAccountId,
        name: name.value.trim(),
        type: account.type || "",
        year: nextYear,
        budgetStartMonth: nextStartMonth,
        budgetDuration: 12,
        createdAt: new Date().toISOString(),
        rolledFrom: account.id,
      };
      saveAccounts(
        getAccounts().map((entry) =>
          entry.id === account.id
            ? { ...entry, rolledTo: newAccountId, closedAt: new Date().toISOString() }
            : entry,
        ).concat(nextAccount),
      );
      saveAccountData(newAccountId, nextData);
      window.localStorage.setItem(ACTIVE_ACCOUNT_KEY, newAccountId);
      window.localStorage.setItem(tutorialKey(newAccountId), "complete");
      const preferences = readJson(PREFERENCES_KEY, {});
      window.localStorage.setItem(
        PREFERENCES_KEY,
        JSON.stringify({ ...preferences, "budget-year": String(nextYear) }),
      );
      window.location.reload();
    });
    actions.append(later, create);
    panel.append(header, intro, form, summary, actions);
    layer.appendChild(panel);
    window.localStorage.setItem(
      `lemon-glass.year-rollover.${account.id}.${accountYear}`,
      new Date().toISOString(),
    );
    window.setTimeout(() => name.select(), 0);
  }

  function openAccountWizard(firstRun) {
    const today = new Date();
    const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const draft = { name: "", type: "", openingBalance: "", budgetStartMonth: currentMonthKey, budgetDuration: "12" };
    let step = 0;
    const layer = createLayer({ dismissible: !firstRun, className: "av-wizard-layer" });
    const panel = element("section", "av-wizard av-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.tabIndex = -1;
    layer.appendChild(panel);

    const render = () => {
      panel.replaceChildren();

      const header = element("div", "av-panel-header");
      const heading = element("div");
      heading.appendChild(
        element(
          "span",
          "av-eyebrow",
          firstRun ? "Welcome to Lemon Glass" : "New account",
        ),
      );
      heading.appendChild(
        element(
          "h2",
          "",
          ["A calm start for your money", "Name your account", "Your quick tour"][step],
        ),
      );
      header.appendChild(heading);
      if (!firstRun) header.appendChild(createCloseButton(layer));
      panel.appendChild(header);

      const progress = element("div", "av-step-progress");
      for (let index = 0; index < 3; index += 1) {
        const dot = element("span", index <= step ? "is-active" : "");
        dot.setAttribute("aria-label", `Step ${index + 1}`);
        progress.appendChild(dot);
      }
      panel.appendChild(progress);

      const content = element("div", "av-wizard-content");
      if (step === 0) {
        const art = element("div", "av-welcome-art");
        art.append(icon("✦"), icon("◌"), icon("✓"));
        content.appendChild(art);
        content.appendChild(
          element(
            "p",
            "av-wizard-lead",
            "Begin with a completely blank account. Lemon Glass will keep every account separate and help you learn the essentials as you go.",
          ),
        );
        const promises = element("div", "av-promise-grid");
        [
          ["Blank by design", "No sample transactions or filled-in forms."],
          ["Private on this device", "Your account data stays in the desktop app."],
          ["Easy to grow", "Add and switch between named accounts anytime."],
        ].forEach(([name, description]) => {
          const item = element("div", "av-promise");
          item.append(icon("✓"), element("strong", "", name), element("p", "", description));
          promises.appendChild(item);
        });
        content.appendChild(promises);
      }

      if (step === 1) {
        content.appendChild(
          element(
            "p",
            "av-wizard-lead",
            "Give this account a name you will recognize. Every field starts blank; only the name is required.",
          ),
        );
        const form = element("div", "av-account-form");

        const nameField = element("label", "av-field");
        nameField.appendChild(element("span", "", "Account name"));
        const nameInput = element("input");
        nameInput.id = "av-account-name";
        nameInput.placeholder = "Name this account";
        nameInput.value = draft.name;
        nameInput.autocomplete = "off";
        nameInput.addEventListener("input", () => {
          draft.name = nameInput.value;
          error.textContent = "";
        });
        nameField.appendChild(nameInput);

        const typeField = element("label", "av-field");
        typeField.appendChild(element("span", "", "Account type (optional)"));
        const typeSelect = element("select");
        typeSelect.id = "av-account-type";
        [
          ["", "Choose an account type"],
          ["Checking", "Checking"],
          ["Savings", "Savings"],
          ["Cash", "Cash"],
          ["Credit", "Credit"],
        ].forEach(([value, label], index) => {
          const option = element("option", "", label);
          option.value = value;
          if (index === 0) option.disabled = true;
          typeSelect.appendChild(option);
        });
        typeSelect.value = draft.type;
        typeSelect.addEventListener("change", () => {
          draft.type = typeSelect.value;
        });
        typeField.appendChild(typeSelect);

        const balanceField = element("label", "av-field");
        balanceField.appendChild(element("span", "", "Opening balance (optional)"));
        const balanceInput = element("input");
        balanceInput.id = "av-opening-balance";
        balanceInput.type = "text";
        balanceInput.inputMode = "decimal";
        balanceInput.placeholder = "0,00 €";
        balanceInput.value = draft.openingBalance;
        balanceInput.addEventListener("input", () => {
          draft.openingBalance = balanceInput.value;
        });
        balanceField.appendChild(balanceInput);

        const startMonthField = element("label", "av-field");
        startMonthField.appendChild(element("span", "", "Budget start month"));
        const startMonthInput = element("input");
        startMonthInput.type = "month";
        startMonthInput.min = currentMonthKey;
        startMonthInput.value = draft.budgetStartMonth;
        startMonthInput.addEventListener("change", () => {
          draft.budgetStartMonth = startMonthInput.value || currentMonthKey;
        });
        startMonthField.appendChild(startMonthInput);

        const durationField = element("label", "av-field");
        durationField.appendChild(element("span", "", "Budget duration (months)"));
        const durationInput = element("input");
        durationInput.type = "number";
        durationInput.min = "1";
        durationInput.max = "120";
        durationInput.value = draft.budgetDuration;
        durationInput.addEventListener("input", () => {
          draft.budgetDuration = durationInput.value;
        });
        durationField.appendChild(durationInput);

        const error = element("p", "av-form-error");
        error.id = "av-account-error";
        form.append(nameField, typeField, balanceField, startMonthField, durationField, error);
        content.appendChild(form);
        window.setTimeout(() => nameInput.focus(), 0);
      }

      if (step === 2) {
        content.appendChild(
          element(
            "p",
            "av-wizard-lead",
            `“${draft.name}” will open completely blank. After it is created, four friendly pointers will show you where to begin.`,
          ),
        );
        const tour = element("div", "av-tour-preview");
        [
          ["1", "Switch accounts", "Use your account name at the top of the sidebar."],
          ["2", "Add activity", "Quick add records income, expenses, bills, goals, and reserves."],
          ["3", "Plan recurring costs", "Bills and recurring expenses keep future spending visible."],
          ["4", "Build goals", "Savings & Goals turns targets into steady progress."],
        ].forEach(([number, name, description]) => {
          const item = element("div", "av-tour-preview-item");
          item.append(
            element("span", "av-tour-number", number),
            element("strong", "", name),
            element("p", "", description),
          );
          tour.appendChild(item);
        });
        content.appendChild(tour);
      }

      panel.appendChild(content);

      const actions = element("div", "av-wizard-actions");
      if (step > 0) {
        const back = element("button", "av-secondary-button", "Back");
        back.type = "button";
        back.addEventListener("click", () => {
          step -= 1;
          render();
        });
        actions.appendChild(back);
      } else {
        actions.appendChild(element("span"));
      }

      const next = element(
        "button",
        "av-primary-button",
        step === 2 ? "Create account & start tour" : step === 0 ? "Get started" : "Continue",
      );
      next.type = "button";
      next.addEventListener("click", () => {
        if (step === 1 && !draft.name.trim()) {
          const error = panel.querySelector("#av-account-error");
          if (error) error.textContent = "Please give your account a name.";
          panel.querySelector("#av-account-name")?.focus();
          return;
        }
        if (step < 2) {
          step += 1;
          render();
          return;
        }

        const duration = Math.round(Number(draft.budgetDuration));
        if (!/^\d{4}-\d{2}$/.test(draft.budgetStartMonth) || duration < 1 || duration > 120) {
          const error = panel.querySelector("#av-account-error");
          if (error) error.textContent = "Choose a start month and a duration from 1 to 120 months.";
          return;
        }
        const account = {
          id: makeId(),
          name: draft.name.trim(),
          type: draft.type,
          year: Number(draft.budgetStartMonth.slice(0, 4)),
          budgetStartMonth: draft.budgetStartMonth,
          budgetDuration: duration,
          createdAt: new Date().toISOString(),
        };
        const accounts = getAccounts();
        accounts.push(account);
        window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
        window.localStorage.setItem(ACTIVE_ACCOUNT_KEY, account.id);
        window.localStorage.setItem(
          accountDataKey(account.id),
          JSON.stringify(emptyAccountData(parseBalance(draft.openingBalance), `${draft.budgetStartMonth}-01`)),
        );
        window.localStorage.setItem(tutorialKey(account.id), "pending");
        window.location.reload();
      });
      actions.appendChild(next);
      panel.appendChild(actions);
    };

    render();
    window.setTimeout(() => panel.focus(), 0);
  }

  function startProductTour(account) {
    if (!account || window.localStorage.getItem(tutorialKey(account.id)) !== "pending") {
      return;
    }

    const steps = [
      {
        selector: ".main-wrap .summary-grid",
        title: "Your main dashboard",
        copy: "Your balances, monthly activity, upcoming bills, and safe-to-spend money stay visible here while the tour guides you.",
      },
      {
        selector: "#av-account-switcher",
        title: "Your named account",
        copy: "Open this menu to add another account or switch between your accounts. Each one keeps its own data.",
      },
      {
        selector: ".sidebar-footer .primary-btn, .primary-btn",
        title: "Quick add",
        copy: "Use Quick add to record income, an expense, a bill, a goal, or a Money Reserve.",
      },
      {
        navLabel: "Bills",
        title: "Stay ahead of bills",
        copy: "Bills are grouped by due date, with reserved amounts kept visible so nothing surprises you.",
      },
      {
        navLabel: "Savings & Goals",
        title: "Make progress visible",
        copy: "Create savings goals here and track the distance to every milestone.",
      },
    ];
    let index = 0;
    let highlight = null;
    const layer = createLayer({ dismissible: false, className: "av-tour-layer" });
    const card = element("section", "av-tour-card");
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-live", "polite");
    layer.appendChild(card);

    const findTarget = (step) => {
      if (step.selector) return document.querySelector(step.selector);
      return Array.from(document.querySelectorAll(".nav-item, .sidebar button")).find(
        (node) => node.textContent.trim().includes(step.navLabel),
      );
    };

    const finish = () => {
      highlight?.classList.remove("av-tour-highlight");
      window.localStorage.setItem(tutorialKey(account.id), "complete");
      closeLayer(layer);
    };

    const render = () => {
      highlight?.classList.remove("av-tour-highlight");
      highlight = findTarget(steps[index]);
      highlight?.classList.add("av-tour-highlight");
      highlight?.scrollIntoView({ behavior: "smooth", block: "center" });
      card.replaceChildren();
      card.appendChild(
        element("span", "av-eyebrow", `Guided tour · ${index + 1} of ${steps.length}`),
      );
      card.appendChild(element("h2", "", steps[index].title));
      card.appendChild(element("p", "", steps[index].copy));
      const actions = element("div", "av-tour-actions");
      const skip = element("button", "av-link-button", "Skip tour");
      skip.type = "button";
      skip.addEventListener("click", finish);
      const next = element(
        "button",
        "av-primary-button",
        index === steps.length - 1 ? "Finish" : "Next",
      );
      next.type = "button";
      next.addEventListener("click", () => {
        if (index === steps.length - 1) {
          finish();
          return;
        }
        index += 1;
        render();
      });
      actions.append(skip, next);
      card.appendChild(actions);
    };

    window.setTimeout(render, 350);
  }

  function initialize() {
    attachAccountSwitcher();
    const observer = new MutationObserver(() => attachAccountSwitcher());
    observer.observe(document.getElementById("root") || document.body, {
      childList: true,
      subtree: true,
    });

    const accounts = getAccounts();
    if (!accounts.length) {
      openAccountWizard(true);
      return;
    }
    const active = getActiveAccount();
    startProductTour(active);
    const preferences = readJson(PREFERENCES_KEY, {});
    const accountYear = Number(active?.year || new Date().getFullYear());
    const reminderKey = `lemon-glass.year-rollover.${active?.id}.${accountYear}`;
    if (
      active &&
      preferences["year-end-rollover-reminder"] !== false &&
      new Date().getFullYear() > accountYear &&
      !window.localStorage.getItem(reminderKey)
    ) {
      window.setTimeout(openYearRollover, 700);
    }
  }

  window.LemonGlassAccounts = {
    active: getActiveAccount,
    accounts: getAccounts,
    edit: openEditAccount,
    remove: openDeleteAccount,
    manager: openAccountManager,
    rollover: openYearRollover,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
