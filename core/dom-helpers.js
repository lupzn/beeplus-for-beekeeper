// Shared DOM helpers across BeePlus features.
// Beekeeper uses Vue + Backbone with `data-bkpr-id` attributes on key UI elements.

(function (root) {
  // Try several common selectors for resilient element lookup.
  function findChatList() {
    return document.querySelector(
      '[data-bkpr-id="chat-list"], [data-bkpr-id="streams-list"], [data-bkpr-id="conversations-list"], .bkpr-chat-list, .conversation-list, nav .stream-list'
    );
  }

  function findComposer() {
    return document.querySelector(
      '[data-bkpr-id="composer"], [data-bkpr-id="message-composer"], .bkpr-composer, .message-composer, [contenteditable="true"][data-bkpr-id*="composer"]'
    );
  }

  function findComposerTextarea(scope) {
    const root = scope || document;
    return root.querySelector(
      'textarea[data-bkpr-id*="composer"], [contenteditable="true"][data-bkpr-id*="composer"], textarea.composer-input, .composer textarea, .composer [contenteditable="true"]'
    );
  }

  function findMessages() {
    return document.querySelectorAll(
      '[data-bkpr-id="message"], [data-bkpr-id*="message-bubble"], .bkpr-message, .message-item'
    );
  }

  // Wait until selector matches in DOM (or timeout). Returns element or null.
  function waitFor(selectorFn, timeoutMs = 10000) {
    return new Promise((resolve) => {
      const start = Date.now();
      const t = setInterval(() => {
        const el = selectorFn();
        if (el) { clearInterval(t); resolve(el); }
        else if (Date.now() - start > timeoutMs) { clearInterval(t); resolve(null); }
      }, 200);
    });
  }

  // MutationObserver registration with cleanup.
  function observe(target, opts, cb) {
    const mo = new MutationObserver(cb);
    mo.observe(target, opts);
    return () => mo.disconnect();
  }

  // Insert HTML element near another (after).
  function insertAfter(newEl, refEl) {
    if (refEl.nextSibling) refEl.parentNode.insertBefore(newEl, refEl.nextSibling);
    else refEl.parentNode.appendChild(newEl);
  }

  // Trigger native input event (Vue/React listen to this).
  // Uses the prototype's value setter so frameworks see the change.
  function triggerInput(el, value) {
    if (el.tagName === "TEXTAREA") {
      const desc = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
      desc.set.call(el, value);
    } else if (el.tagName === "INPUT") {
      const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
      desc.set.call(el, value);
    } else if (el.isContentEditable) {
      el.textContent = value;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  function downloadJson(filename, data) {
    downloadBlob(filename, new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  }

  function downloadCsv(filename, rows) {
    const escape = (v) => {
      if (v == null) return "";
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const csv = rows.map((r) => r.map(escape).join(",")).join("\r\n");
    downloadBlob(filename, new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  }

  root.BeePlus = root.BeePlus || {};
  root.BeePlus.dom = {
    findChatList,
    findComposer,
    findComposerTextarea,
    findMessages,
    waitFor,
    observe,
    insertAfter,
    triggerInput,
    downloadBlob,
    downloadJson,
    downloadCsv
  };
})(window);
