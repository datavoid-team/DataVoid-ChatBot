import { GoogleGenerativeAI } from "@google/generative-ai";
import md from "markdown-it";
import hljs from "highlight.js";

// --- 1. CONFIGURATION & MARKDOWN SETUP ---

// Custom Markdown Renderer to inject "Copy" buttons
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

    // Return the custom HTML structure with Copy Button
    return `
      <div class="code-wrapper group">
        <div class="code-header">
          <span>${language}</span>
          <button class="copy-btn" data-code="${encodeURIComponent(str)}">
            <svg class="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
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

let history = [];
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

// --- 4. GLOBAL EVENT DELEGATION FOR COPY BUTTONS ---
// We attach this to document so it works for dynamically added buttons
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.copy-btn');
  if (!btn) return;

  const code = decodeURIComponent(btn.dataset.code);
  try {
    await navigator.clipboard.writeText(code);
    
    // Visual Feedback
    const originalContent = btn.innerHTML;
    btn.innerHTML = `<svg class="copy-icon text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> <span class="text-green-500">Copied!</span>`;
    
    setTimeout(() => {
      btn.innerHTML = originalContent;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
  }
});

// --- 5. CHAT LOGIC (STREAMING) ---

async function handleChat(userText) {
  if (isProcessing || !userText.trim()) return;
  isProcessing = true;
  sendBtn.disabled = true;

  // UI Cleanup
  if (welcomeScreen) welcomeScreen.style.display = 'none';
  promptInput.value = "";
  promptInput.style.height = "auto";

  // 1. Add User Message
  chatContainer.insertAdjacentHTML('beforeend', `
    <div class="flex justify-end pl-10 animate-fade-in">
      <div class="bg-void-accent text-white max-w-full md:max-w-[85%] rounded-2xl rounded-tr-sm px-5 py-3.5 shadow-lg">
        <div class="prose prose-invert prose-sm font-sans whitespace-pre-wrap">${markdown.utils.escapeHtml(userText)}</div>
      </div>
    </div>
  `);
  scrollToBottom();

  // 2. Create Placeholder for AI Response
  const aiMessageId = `ai-${Date.now()}`;
  chatContainer.insertAdjacentHTML('beforeend', `
    <div class="flex justify-start w-full pr-10 animate-fade-in mb-8" id="wrapper-${aiMessageId}">
      <div class="flex gap-4 max-w-full md:max-w-[90%]">
        <img src="/chat-bot.jpg" alt="AI" class="w-8 h-8 rounded-lg mt-1 border border-void-border flex-shrink-0">
        <div class="flex-1 min-w-0">
          <div id="${aiMessageId}" class="prose prose-invert prose-sm max-w-none font-sans leading-relaxed">
            <span class="inline-block w-2 h-2 bg-void-accent rounded-full animate-pulse"></span>
          </div>
        </div>
      </div>
    </div>
  `);
  scrollToBottom();

  const aiContentDiv = document.getElementById(aiMessageId);
  let fullResponse = "";

  try {
    const chat = model.startChat({ history: history });
    
    // 3. Start Streaming Request
    const result = await chat.sendMessageStream(userText);
    
    // 4. Process Stream
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullResponse += chunkText;
      
      // Render Markdown on the fly
      // Note: Rerendering full markdown on every chunk ensures code blocks format correctly as they arrive
      aiContentDiv.innerHTML = markdown.render(fullResponse);
      scrollToBottom();
    }

    // Update History
    history.push(
      { role: "user", parts: [{ text: userText }] },
      { role: "model", parts: [{ text: fullResponse }] }
    );

  } catch (error) {
    console.error(error);
    aiContentDiv.innerHTML = `<div class="text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/20">
      Error: ${error.message}. Please try again.
    </div>`;
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
    location.reload();
  }
});

// Handle suggestions
document.querySelectorAll(".suggestion-btn").forEach(btn => {
  btn.addEventListener('click', () => {
    const text = btn.querySelector('span:first-child').innerText;
    handleChat(text);
  });
});