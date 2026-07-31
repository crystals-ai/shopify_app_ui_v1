/**
 * chat_widget/widget.js — Embeddable AI shopping assistant widget.
 *
 * Usage (drop into the brand's site, right before </body>):
 *
 *   <script>
 *     window.RAG_CHAT_CONFIG = {
 *       apiUrl: "https://your-cloudfront-domain.cloudfront.net/chat",
 *       apiKey: "your-api-key",
 *       brandName: "Renity",
 *       suggestedQuestions: [
 *         "What are the main ingredients?",
 *         "Is this suitable for sensitive skin?",
 *         "What is your return policy?",
 *       ],
 *     };
 *   </script>
 *   <script src="https://your-cdn.example.com/widget.js"></script>
 *
 * No build step, no dependencies. Injects its own CSS and DOM.
 */
(function () {
  const config = Object.assign(
    {
      apiUrl: "/chat",
      apiKey: null,
      brandName: "Assistant",
      accentColor: "#1a56ff",
      accentTextColor: "#fff",
      accentOutlineColor: null, // defaults to accentColor below; set separately if accentColor doesn't have enough contrast against white
      suggestedQuestions: [],
      statusMessages: [
        "Thinking...",
        "Fetching brand details...",
        "Fetching product details...",
        "Putting together an answer...",
      ],
    },
    window.RAG_CHAT_CONFIG || {}
  );
  if (!config.accentOutlineColor) config.accentOutlineColor = config.accentColor;

  function authHeaders() {
    const headers = { "Content-Type": "application/json" };
    if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;
    return headers;
  }

  // ---------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------
  const style = document.createElement("style");
  style.textContent = `
    #rag-chat-bubble {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: ${config.accentColor};
      box-shadow: 0 4px 16px rgba(0,0,0,0.25);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      transition: transform 0.15s ease;
      border: none;
    }
    #rag-chat-bubble:hover { transform: scale(1.06); }
    #rag-chat-bubble svg { width: 28px; height: 28px; fill: ${config.accentTextColor}; }

    #rag-chat-panel {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 440px;
      max-width: calc(100vw - 32px);
      height: calc(100vh - 48px);
      max-height: 820px;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.28);
      display: none;
      flex-direction: column;
      overflow: hidden;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    #rag-chat-panel.open { display: flex; }

    #rag-chat-header {
      background: ${config.accentColor};
      color: ${config.accentTextColor};
      padding: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    #rag-chat-header .title { font-size: 15px; font-weight: 600; }
    #rag-chat-header .subtitle { font-size: 12px; opacity: 0.85; }
    #rag-chat-close {
      background: none; border: none; color: ${config.accentTextColor}; cursor: pointer;
      font-size: 20px; line-height: 1; padding: 4px;
    }

    #rag-chat-messages {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      background: #f7f8fa;
    }
    .rag-msg {
      max-width: 84%;
      padding: 10px 13px;
      border-radius: 14px;
      font-size: 13.5px;
      line-height: 1.45;
      white-space: pre-wrap;
      word-wrap: break-word;
      flex-shrink: 0;
    }
    .rag-msg.user {
      align-self: flex-end;
      background: ${config.accentColor};
      color: ${config.accentTextColor};
      border-bottom-right-radius: 4px;
    }
    .rag-msg.assistant {
      align-self: flex-start;
      background: #fff;
      color: #1a1a1a;
      border: 1px solid #e6e8eb;
      border-bottom-left-radius: 4px;
    }
    .rag-msg.assistant a {
      color: #1a56ff;
      text-decoration: underline;
    }
    .rag-msg.assistant a:hover { text-decoration: none; }
    .rag-msg.assistant ul {
      margin: 4px 0;
      padding-left: 18px;
    }
    .rag-msg.assistant li { margin: 2px 0; }
    .rag-msg.assistant.typing::after {
      content: "█";
      animation: rag-blink 1s step-start infinite;
    }
    @keyframes rag-blink { 50% { opacity: 0; } }
    .rag-msg.assistant.status {
      color: #6b7280;
      font-style: italic;
    }

    #rag-chat-suggestions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 12px 16px 12px;
      flex-shrink: 0;
    }
    .rag-suggestion-chip {
      border: 1px solid ${config.accentOutlineColor};
      color: ${config.accentOutlineColor};
      background: #fff;
      border-radius: 16px;
      padding: 6px 12px;
      font-size: 12.5px;
      cursor: pointer;
      white-space: nowrap;
    }
    .rag-suggestion-chip:hover { background: color-mix(in srgb, ${config.accentColor} 12%, white); }

    .rag-products-grid {
      display: flex;
      gap: 10px;
      overflow-x: auto;
      padding: 2px 2px 6px;
      align-self: stretch;
      max-width: 100%;
      flex-shrink: 0;
    }
    .rag-product-card {
      flex: 0 0 128px;
      width: 128px;
      background: #fff;
      border: 1px solid #e6e8eb;
      border-radius: 12px;
      padding: 8px;
      text-decoration: none;
      color: inherit;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .rag-product-card:hover { border-color: ${config.accentOutlineColor}; }
    .rag-product-img {
      width: 100%;
      height: 96px;
      border-radius: 8px;
      background-color: #f0f1f3;
      background-size: cover;
      background-position: center;
    }
    .rag-product-title {
      font-size: 12px;
      font-weight: 600;
      line-height: 1.3;
      color: #1a1a1a;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .rag-product-meta {
      font-size: 11px;
      color: #6b7280;
    }
    .rag-product-price {
      font-size: 12px;
      font-weight: 700;
      color: ${config.accentOutlineColor};
    }

    #rag-chat-input-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      border-top: 1px solid #e6e8eb;
      flex-shrink: 0;
      background: #fff;
    }
    #rag-chat-input {
      flex: 1;
      border: 1px solid #d7dae0;
      border-radius: 20px;
      padding: 10px 14px;
      font-size: 13.5px;
      outline: none;
      resize: none;
    }
    #rag-chat-input:focus { border-color: ${config.accentOutlineColor}; }
    #rag-chat-send {
      background: ${config.accentColor};
      border: none;
      color: ${config.accentTextColor};
      width: 38px;
      height: 38px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    #rag-chat-send:disabled { opacity: 0.5; cursor: default; }
    #rag-chat-send svg { width: 16px; height: 16px; fill: ${config.accentTextColor}; }
  `;
  document.head.appendChild(style);

  // ---------------------------------------------------------------------
  // DOM
  // ---------------------------------------------------------------------
  const bubble = document.createElement("button");
  bubble.id = "rag-chat-bubble";
  bubble.setAttribute("aria-label", "Open chat assistant");
  bubble.innerHTML = `<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>`;

  const panel = document.createElement("div");
  panel.id = "rag-chat-panel";
  panel.innerHTML = `
    <div id="rag-chat-header">
      <div>
        <div class="title">${config.brandName} Assistant</div>
        <div class="subtitle">Ask me anything about our products</div>
        <div class="subtitle">Powered by SuperSearch</div>
      </div>
      <button id="rag-chat-close" aria-label="Close chat">&times;</button>
    </div>
    <div id="rag-chat-messages"></div>
    <div id="rag-chat-suggestions"></div>
    <div id="rag-chat-input-row">
      <textarea id="rag-chat-input" rows="1" placeholder="Type your question..."></textarea>
      <button id="rag-chat-send" aria-label="Send">
        <svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>
      </button>
    </div>
  `;

  document.body.appendChild(bubble);
  document.body.appendChild(panel);

  const messagesEl = panel.querySelector("#rag-chat-messages");
  const suggestionsEl = panel.querySelector("#rag-chat-suggestions");
  const inputEl = panel.querySelector("#rag-chat-input");
  const sendBtn = panel.querySelector("#rag-chat-send");
  const closeBtn = panel.querySelector("#rag-chat-close");

  // ---------------------------------------------------------------------
  // Behaviour
  // ---------------------------------------------------------------------
  let panelOpened = false;
  let sessionId = null;
  let hasSentMessage = false;

  function openPanel() {
    panel.classList.add("open");
    if (!panelOpened) {
      renderSuggestions();
      resolveInitialFaqIds();
      panelOpened = true;
    }
    inputEl.focus();
  }

  function closePanel() {
    panel.classList.remove("open");
  }

  bubble.addEventListener("click", () => {
    panel.classList.contains("open") ? closePanel() : openPanel();
  });
  closeBtn.addEventListener("click", closePanel);

  function renderSuggestions() {
    suggestionsEl.innerHTML = "";
    config.suggestedQuestions.forEach((q) => {
      const chip = document.createElement("button");
      chip.className = "rag-suggestion-chip";
      chip.textContent = q;
      chip.addEventListener("click", () => sendMessage(q));
      suggestionsEl.appendChild(chip);
    });
  }

  // Matches demo.html's static suggestedQuestions against the FAQ CSV
  // (server-side) so the very first chips can also carry a faq_id and
  // stream their answer instantly instead of calling the LLM.
  async function resolveInitialFaqIds() {
    if (!config.suggestedQuestions.length) return;
    try {
      const lookupUrl = config.apiUrl.replace(/\/chat$/, "/faq-lookup");
      const response = await fetch(lookupUrl, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ questions: config.suggestedQuestions }),
      });
      if (!response.ok) return;
      const { suggestions } = await response.json();
      if (hasSentMessage || !suggestions) return; // user already moved on
      renderFaqSuggestions(suggestions);
    } catch (_) {
      // Keep the plain chips rendered by renderSuggestions(); they'll just
      // fall back to an LLM call instead of streaming from the CSV.
    }
  }

  function renderFaqSuggestions(suggestions) {
    suggestionsEl.innerHTML = "";
    (suggestions || []).forEach((s) => {
      const chip = document.createElement("button");
      chip.className = "rag-suggestion-chip";
      chip.textContent = s.question;
      chip.addEventListener("click", () => sendMessage(s.question, s.id));
      suggestionsEl.appendChild(chip);
    });
  }

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function formatPrice(price) {
    if (price === null || price === undefined || price === "") return "";
    const str = String(price);
    return /^[\d.,]+$/.test(str) ? `₹${str}` : str;
  }

  // Renders a horizontally-scrollable row of product cards, inserted right
  // before `beforeEl` so cards line up above the assistant's explanatory text
  // (matching the order the backend sends them: products first, then answer).
  function renderProducts(products, beforeEl) {
    if (!products || !products.length) return;
    const wrap = document.createElement("div");
    wrap.className = "rag-products-grid";
    products.forEach((p) => {
      const card = document.createElement("a");
      card.className = "rag-product-card";
      card.href = p.product_url || "#";
      card.target = "_blank";
      card.rel = "noopener noreferrer";
      const meta = [p.colour, p.size].filter(Boolean).join(" · ");
      card.innerHTML = `
        <div class="rag-product-img" style="background-image:url('${(p.image_url || "").replace(/'/g, "%27")}')"></div>
        <div class="rag-product-title">${escapeHtml(p.title || "")}</div>
        ${meta ? `<div class="rag-product-meta">${escapeHtml(meta)}</div>` : ""}
        ${p.price ? `<div class="rag-product-price">${escapeHtml(formatPrice(p.price))}</div>` : ""}
      `;
      wrap.appendChild(card);
    });
    messagesEl.insertBefore(wrap, beforeEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // Minimal markdown renderer: bullet lists, **bold**, *italic*/_italic_,
  // and auto-linked URLs. Deliberately small (no build step / dependencies)
  // and re-runs safely on the growing string as tokens stream in.
  function renderMarkdown(text) {
    const lines = escapeHtml(text).split("\n");
    const blocks = [];
    let listBuffer = [];

    function flushList() {
      if (listBuffer.length) {
        blocks.push("<ul>" + listBuffer.map((item) => `<li>${item}</li>`).join("") + "</ul>");
        listBuffer = [];
      }
    }

    lines.forEach((line) => {
      const bulletMatch = line.match(/^\s*[*-]\s+(.*)$/);
      if (bulletMatch) {
        listBuffer.push(bulletMatch[1]);
      } else {
        flushList();
        blocks.push(line);
      }
    });
    flushList();

    let html = blocks.join("\n");
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, "$1<em>$2</em>");
    html = html.replace(/\b_(.+?)_\b/g, "<em>$1</em>");
    html = html.replace(/(https?:\/\/[^\s<]+)/g, (url) => {
      const clean = url.replace(/[).,;!?]+$/, "");
      const trailing = url.slice(clean.length);
      return `<a href="${clean}" target="_blank" rel="noopener noreferrer">${clean}</a>${trailing}`;
    });

    return html.split("\n").join("<br>");
  }

  function addMessage(role, text) {
    const el = document.createElement("div");
    el.className = `rag-msg ${role}`;
    if (role === "assistant") {
      el.innerHTML = renderMarkdown(text);
    } else {
      el.textContent = text;
    }
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return el;
  }

  async function sendMessage(question, faqId) {
    question = (question || inputEl.value).trim();
    if (!question) return;

    hasSentMessage = true;
    inputEl.value = "";
    sendBtn.disabled = true;
    suggestionsEl.innerHTML = "";

    addMessage("user", question);
    const assistantEl = addMessage("assistant", "");
    assistantEl.classList.add("status");

    assistantEl.textContent = config.statusMessages[0] || "Thinking...";
    const statusDelayMs = 3000;
    const statusTimeouts = config.statusMessages.slice(1).map((msg, i) =>
      setTimeout(() => {
        assistantEl.textContent = msg;
      }, statusDelayMs * (i + 1))
    );

    function stopStatusCycle() {
      statusTimeouts.forEach(clearTimeout);
      assistantEl.classList.remove("status");
      assistantEl.textContent = "";
    }

    try {
      const body = { message: question, user_id: sessionId };
      if (typeof faqId === "number") body.faq_id = faqId;

      const response = await fetch(config.apiUrl, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";
      let firstTokenReceived = false;
      let faqSuggestions = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by a blank line, each line starts with "data: "
        const frames = buffer.split("\n\n");
        buffer = frames.pop(); // last (possibly incomplete) frame stays in buffer

        for (const frame of frames) {
          const line = frame.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.user_id) {
              sessionId = parsed.user_id;
              continue;
            }
            if (parsed.suggestions) {
              faqSuggestions = parsed.suggestions;
              continue;
            }
            if (parsed.products) {
              renderProducts(parsed.products, assistantEl);
              continue;
            }
            const { token } = parsed;
            if (!token) continue;
            if (!firstTokenReceived) {
              stopStatusCycle();
              assistantEl.classList.add("typing");
              firstTokenReceived = true;
            }
            answer += token;
            assistantEl.innerHTML = renderMarkdown(answer);
            messagesEl.scrollTop = messagesEl.scrollHeight;
          } catch (_) {
            // ignore malformed frame
          }
        }
      }

      if (!answer) {
        stopStatusCycle();
        assistantEl.textContent = "Sorry, I couldn't find an answer to that.";
      }

      if (faqSuggestions) {
        renderFaqSuggestions(faqSuggestions);
        // Suggestion chips take up vertical space, shrinking the messages
        // pane — rescroll so the tail of the reply isn't hidden behind them.
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
    } catch (err) {
      stopStatusCycle();
      assistantEl.textContent = "Something went wrong. Please try again.";
      console.error("[rag-chat]", err);
    } finally {
      statusTimeouts.forEach(clearTimeout);
      assistantEl.classList.remove("typing");
      sendBtn.disabled = false;
    }
  }

  sendBtn.addEventListener("click", () => sendMessage());
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
})();
