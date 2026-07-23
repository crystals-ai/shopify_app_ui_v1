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
      showBanner: true,
      bannerText: null, // defaults to `Chat with ${brandName} AI Shopping Assistant`
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
  if (!config.bannerText) config.bannerText = `Chat with ${config.brandName} AI Shopping Assistant`;

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

    #rag-chat-banner {
      position: fixed;
      bottom: 96px;
      right: 24px;
      max-width: 230px;
      background: #fff;
      color: #1a1a1a;
      border: 1px solid #e6e8eb;
      border-radius: 14px;
      padding: 12px 32px 12px 16px;
      font-size: 13px;
      font-weight: 600;
      line-height: 1.35;
      box-shadow: 0 8px 24px rgba(0,0,0,0.2);
      cursor: pointer;
      z-index: 999998;
      opacity: 0;
      transform: translateY(12px) scale(0.96);
      transition: opacity 0.45s ease-out, transform 0.45s ease-out;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    /* Visibility (opacity/position) is driven by a transition on .visible,
       kept entirely separate from the .bounce keyframe animation below —
       otherwise swapping animation-name mid-flight drops the "forwards"
       hold on opacity and the banner silently reverts to opacity:0. */
    #rag-chat-banner.visible {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    #rag-chat-banner::after {
      content: "";
      position: absolute;
      bottom: -7px;
      right: 28px;
      width: 14px;
      height: 14px;
      background: #fff;
      border-right: 1px solid #e6e8eb;
      border-bottom: 1px solid #e6e8eb;
      transform: rotate(45deg);
    }
    #rag-chat-banner.bounce {
      animation: rag-banner-bounce 1.6s ease-in-out 4;
    }
    #rag-chat-banner.hidden { display: none; }
    #rag-chat-banner .rag-banner-dot {
      position: absolute;
      top: -4px;
      left: -4px;
      width: 12px;
      height: 12px;
      background: #ef4444;
      border-radius: 50%;
      animation: rag-banner-pulse 1.6s ease-out infinite;
    }
    #rag-chat-banner-close {
      position: absolute;
      top: 4px;
      right: 6px;
      background: none;
      border: none;
      color: #9aa0a6;
      font-size: 16px;
      line-height: 1;
      cursor: pointer;
      padding: 4px;
    }
    #rag-chat-banner-close:hover { color: #444; }

    @keyframes rag-banner-bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
    @keyframes rag-banner-pulse {
      0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.55); }
      70% { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
      100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
    }

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
      gap: 2px;
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

    #rag-chat-powered-by {
      text-align: center;
      font-size: 13px;
      font-weight: 600;
      color:rgb(41, 42, 43);
      padding: 1px 6px 10px;
      background: #fff;
      flex-shrink: 0;
    }
    #rag-chat-powered-by a {
      color: inherit;
      text-decoration: underline;
    }
  .rag-msg.assistant .rag-product-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 10px 12px;
    margin: 10px 0;
    text-decoration: none !important;
    color: #1f2937 !important;
    box-shadow: 0 2px 6px rgba(0,0,0,0.05);
    transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
  }
  .rag-msg.assistant .rag-product-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    border-color: ${config.accentColor};
  }
  .rag-msg.assistant .rag-card-body {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .rag-msg.assistant .rag-card-title {
    font-weight: 600;
    font-size: 13px;
    line-height: 1.3;
    color: #111827;
  }
  .rag-msg.assistant .rag-card-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: ${config.accentColor};
    color: ${config.accentTextColor} !important;
    font-size: 12px;
    font-weight: 600;
    padding: 6px 12px;
    border-radius: 6px;
    white-space: nowrap;
    flex-shrink: 0;
  }
  `;
  document.head.appendChild(style);

  // ---------------------------------------------------------------------
  // DOM
  // ---------------------------------------------------------------------
  const bubble = document.createElement("button");
  bubble.id = "rag-chat-bubble";
  bubble.setAttribute("aria-label", "Open chat assistant");
  bubble.innerHTML = `<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>`;

  let banner = null;
  if (config.showBanner) {
    banner = document.createElement("div");
    banner.id = "rag-chat-banner";
    banner.setAttribute("role", "button");
    banner.setAttribute("tabindex", "0");
    banner.innerHTML = `
      <span class="rag-banner-dot"></span>
      ${config.bannerText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}
      <button id="rag-chat-banner-close" aria-label="Dismiss">&times;</button>
    `;
  }

  const panel = document.createElement("div");
  panel.id = "rag-chat-panel";
  panel.innerHTML = `
    <div id="rag-chat-header">
      <div>
        <div class="title">${config.brandName} Assistant</div>
        <div class="subtitle">Ask me anything about our products</div>
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
    <div id="rag-chat-powered-by">Powered by <a href="https://supersearch-1k6i.onrender.com/" target="_blank" rel="noopener noreferrer">SuperSearch</a></div>
  `;

  document.body.appendChild(bubble);
  if (banner) document.body.appendChild(banner);
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
    hideBanner();
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

  function hideBanner() {
    if (banner) banner.classList.add("hidden");
  }

  bubble.addEventListener("click", () => {
    panel.classList.contains("open") ? closePanel() : openPanel();
  });
  closeBtn.addEventListener("click", closePanel);

  if (banner) {
    // Fade/slide in first (own transition), then layer a few bounces on top
    // shortly after — kept as two separate class toggles (see CSS comment)
    // so the visible state persists independently of the bounce animation.
    requestAnimationFrame(() => {
      setTimeout(() => banner.classList.add("visible"), 30);
    });
    setTimeout(() => banner.classList.add("bounce"), 550);

    banner.addEventListener("click", openPanel);
    banner.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openPanel();
      }
    });
    banner.querySelector("#rag-chat-banner-close").addEventListener("click", (e) => {
      e.stopPropagation();
      hideBanner();
    });
  }

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

  // Minimal markdown renderer: bullet lists, **bold**, *italic*/_italic_,
  // and auto-linked URLs. Deliberately small (no build step / dependencies)
  // and re-runs safely on the growing string as tokens stream in.
  function renderMarkdown(text) {
    // Helper to extract a human-friendly title if the link anchor text is a raw URL
    function getDisplayTitle(anchorText, url) {
      const rawAnchor = anchorText.trim();
      if (rawAnchor.startsWith("http://") || rawAnchor.startsWith("https://")) {
        try {
          const parsed = new URL(url);
          const pathSegments = parsed.pathname.split("/").filter(Boolean);
          if (pathSegments.length > 0) {
            const slug = pathSegments[pathSegments.length - 1];
            // Converts "healthy-almond-nutties-35-gms" -> "Healthy Almond Nutties 35 Gms"
            return slug
              .replace(/[-_]/g, " ")
              .replace(/\b\w/g, (l) => l.toUpperCase());
          }
        } catch (_) {}
        return "View Product";
      }
      return rawAnchor;
    }
  
    // 1. Convert Markdown links [Title](URL) into Product Cards FIRST (before escaping)
    const cards = [];
    const markdownLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    
    let processedText = text.replace(markdownLinkRegex, (match, anchorText, url) => {
      const displayTitle = getDisplayTitle(anchorText, url);
      const cardHtml = `<a href="${url}" target="_blank" rel="noopener noreferrer" class="rag-product-card"><div class="rag-card-body"><div class="rag-card-title">${escapeHtml(displayTitle)}</div><span class="rag-card-btn">View Product &rarr;</span></div></a>`;
      
      cards.push(cardHtml);
      // Replace with a clean, unique HTML-safe token
      return `%%PRODUCT_CARD_${cards.length - 1}%%`;
    });
  
    // 2. Escape HTML for normal markdown text
    let html = escapeHtml(processedText);
  
    // 3. Convert remaining bare URLs into Product Cards
    const bareUrlRegex = /(https?:\/\/[^\s<]+)/g;
    html = html.replace(bareUrlRegex, (url) => {
      const clean = url.replace(/[).,;!?]+$/, "");
      const trailing = url.slice(clean.length);
      const displayTitle = getDisplayTitle(clean, clean);
      
      const cardHtml = `<a href="${clean}" target="_blank" rel="noopener noreferrer" class="rag-product-card"><div class="rag-card-body"><div class="rag-card-title">${escapeHtml(displayTitle)}</div><span class="rag-card-btn">View Product &rarr;</span></div></a>`;
      cards.push(cardHtml);
      return `%%PRODUCT_CARD_${cards.length - 1}%%${trailing}`;
    });
  
    // 4. Handle bullet lists
    const lines = html.split("\n");
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
      if (bulletMatch && !line.includes("%%PRODUCT_CARD_")) {
        listBuffer.push(bulletMatch[1]);
      } else {
        flushList();
        blocks.push(line);
      }
    });
    flushList();
  
    html = blocks.join("\n");
  
    // 5. Bold & Italic formatting
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, "$1<em>$2</em>");
    html = html.replace(/\b_(.+?)_\b/g, "<em>$1</em>");
  
    // 6. Restore the card components into the message
    cards.forEach((cardHtml, index) => {
      html = html.replace(`%%PRODUCT_CARD_${index}%%`, cardHtml);
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
