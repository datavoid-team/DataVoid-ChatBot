import { GoogleGenerativeAI } from "@google/generative-ai";
import md from "markdown-it";
import hljs from "highlight.js";

// --- 1. CONFIGURATION & MARKDOWN SETUP ---

// Custom Markdown Renderer to inject "Copy" buttons for CODE BLOCKS
const markdown = md({
  html: true,
  linkify: true,
  typographer: true,
  highlight: function (str, lang) {
    const language = lang || 'text';
    let highlightedCode;
    try {
      if (lang && hljs.getLanguage(lang)) {
        highlightedCode = hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
      } else {
        highlightedCode = markdown.utils.escapeHtml(str);
      }
    } catch (__) {
      highlightedCode = markdown.utils.escapeHtml(str);
    }

    // Code Block HTML with Copy Button
    return `
      <div class="code-wrapper group/code">
        <div class="code-header">
          <span>${language}</span>
          <button class="copy-btn" data-code="${encodeURIComponent(str)}">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            Copy
          </button>
        </div>
        <pre class="hljs !bg-[#050505] !p-4 overflow-x-auto text-sm"><code>${highlightedCode}</code></pre>
      </div>
    `;
  },
});

const API_KEY = import.meta.env.VITE_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ 
  model: "gemini-2.0-flash",
  systemInstruction: "You are DataVoid AI, developed by the DataVoid Team. You are helpful, precise, and secure. Do not identify as Google Gemini."
});

// --- HISTORY PRE-SEEDING (Fixes Identity Issue) ---
const SYSTEM_PROMPT = [
  {
    role: "user",
    parts: [{ text: "IMPORTANT: You are DataVoid AI, a proprietary model developed by the DataVoid Team. You are NOT a Google model. If asked who made you, answer 'The DataVoid Team'. Do you understand?" }]
  },
  {
    role: "model",
    parts: [{ text: "Understood. I am DataVoid AI, developed by the DataVoid Team." }]
  }
];

let history = [...SYSTEM_PROMPT];
let isProcessing = false;

// --- 2. DOM ELEMENTS ---
const chatContainer = document.getElementById("chat-container");
const chatForm = document.getElementById("chat-form");
const promptInput = document.getElementById("prompt");
const welcomeScreen = document.getElementById("welcome-screen");
const clearBtn = document.getElementById("clear-btn");
const sendBtn = document.getElementById("send-btn");

// --- 3. HELPER FUNCTIONS ---

const scrollToBottom = () => {
  chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: "smooth" });
};

// SVG Icon for Message Copy
const copyIconSVG = `
<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
</svg>
`;

// --- 4. GLOBAL EVENT DELEGATION (HANDLES ALL COPY CLICKS) ---
document.addEventListener('click', async (e) => {
  // A. Handle Code Block Copy
  const codeBtn = e.target.closest('.copy-btn');
  if (codeBtn) {
    handleCopy(codeBtn, decodeURIComponent(codeBtn.dataset.code));
    return;
  }

  // B. Handle Message Bubble Copy
  const msgBtn = e.target.closest('.msg-copy-btn');
  if (msgBtn) {
    const targetId = msgBtn.dataset.target;
    const targetEl = document.getElementById(targetId);
    if (targetEl) {
      // Logic to get text but exclude the "Copy" label from code blocks
      const clone = targetEl.cloneNode(true);
      // Remove code headers so we don't copy the word "Copy" inside code blocks
      clone.querySelectorAll('.code-header').forEach(el => el.remove());
      handleCopy(msgBtn, clone.innerText);
    }
  }
});

// Generic Copy Logic with visual feedback
async function handleCopy(btn, text) {
  try {
    await navigator.clipboard.writeText(text);
    const originalHTML = btn.innerHTML;
    
    // Change Icon to Checkmark
    btn.innerHTML = `<svg class="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    
    setTimeout(() => {
      btn.innerHTML = originalHTML;
    }, 2000);
  } catch (err) {
    console.error('Copy failed:', err);
  }
}

// --- 5. CHAT LOGIC ---

async function handleChat(userText) {
  if (isProcessing || !userText.trim()) return;
  isProcessing = true;
  sendBtn.disabled = true;

  if (welcomeScreen) welcomeScreen.style.display = 'none';
  promptInput.value = "";
  promptInput.style.height = "auto";

  // --- 5a. RENDER USER MESSAGE WITH COPY BUTTON ---
  const userMsgId = `user-${Date.now()}`;
  chatContainer.insertAdjacentHTML('beforeend', `
    <div class="flex justify-end pl-10 animate-fade-in group relative mb-6">
      <button class="msg-copy-btn absolute -left-8 top-2" data-target="${userMsgId}" title="Copy prompt">
        ${copyIconSVG}
      </button>
      
      <div class="bg-void-accent text-white max-w-full md:max-w-[85%] rounded-2xl rounded-tr-sm px-5 py-3.5 shadow-lg">
        <div id="${userMsgId}" class="prose prose-invert prose-sm font-sans whitespace-pre-wrap">${markdown.utils.escapeHtml(userText)}</div>
      </div>
    </div>
  `);
  scrollToBottom();

  // --- 5b. RENDER AI PLACEHOLDER WITH COPY BUTTON ---
  const aiMsgId = `ai-${Date.now()}`;
  chatContainer.insertAdjacentHTML('beforeend', `
    <div class="flex justify-start w-full pr-10 animate-fade-in mb-8 group relative">
      <div class="flex gap-4 max-w-full md:max-w-[90%] w-full">
        <img src="/chat-bot.jpg" alt="AI" class="w-8 h-8 rounded-lg mt-1 border border-void-border flex-shrink-0">
        
        <div class="flex-1 min-w-0">
          <div id="${aiMsgId}" class="prose prose-invert prose-sm max-w-none font-sans leading-relaxed">
            <span class="inline-block w-2 h-2 bg-void-accent rounded-full animate-pulse"></span>
          </div>
        </div>
      </div>

      <button class="msg-copy-btn absolute right-0 top-1" data-target="${aiMsgId}" title="Copy response">
        ${copyIconSVG}
      </button>
    </div>
  `);
  scrollToBottom();

  const aiContentDiv = document.getElementById(aiMsgId);
  let fullResponse = "";

  try {
    const chat = model.startChat({ history: history });
    const result = await chat.sendMessageStream(userText);
    
    for await (const chunk of result.stream) {
      fullResponse += chunk.text();
      aiContentDiv.innerHTML = markdown.render(fullResponse);
      scrollToBottom();
    }

    history.push(
      { role: "user", parts: [{ text: userText }] },
      { role: "model", parts: [{ text: fullResponse }] }
    );

  } catch (error) {
    console.error(error);
    aiContentDiv.innerHTML = `<div class="text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/20">Error: ${error.message}</div>`;
  }

  isProcessing = false;
  sendBtn.disabled = false;
  promptInput.focus();
}

// --- 6. EVENT LISTENERS ---

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  handleChat(promptInput.value);
});

promptInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleChat(promptInput.value);
  }
});

promptInput.addEventListener("input", function() {
  this.style.height = "auto";
  this.style.height = Math.min(this.scrollHeight, 200) + "px";
});

clearBtn.addEventListener("click", () => {
  if (confirm("Clear conversation history?")) {
    history = [...SYSTEM_PROMPT]; // Reset to system prompt
    location.reload();
  }
});

document.querySelectorAll(".suggestion-btn").forEach(btn => {
  btn.addEventListener('click', () => {
    const text = btn.querySelector('span:first-child').innerText;
    handleChat(text);
  });
});