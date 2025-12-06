import { GoogleGenerativeAI } from "@google/generative-ai";
import md from "markdown-it";
import hljs from "highlight.js";

// --- Configuration ---
const markdown = md({
  html: true,
  linkify: true,
  typographer: true,
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<div class="code-block-wrapper my-4 border border-gray-800 rounded-lg overflow-hidden">
          <div class="bg-[#1a1a1a] px-4 py-1.5 text-xs text-gray-400 border-b border-gray-800 flex justify-between">
            <span>${lang}</span>
            <span>Code</span>
          </div>
          <pre class="hljs !bg-[#0a0a0a] !p-4 !m-0 text-sm overflow-x-auto"><code>${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>
        </div>`;
      } catch (__) {}
    }
    return `<pre class="hljs !bg-[#0a0a0a] !p-4 rounded-lg text-sm my-4 border border-gray-800"><code>${markdown.utils.escapeHtml(str)}</code></pre>`;
  },
});

const API_KEY = import.meta.env.VITE_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

// --- Identity Instruction ---
const model = genAI.getGenerativeModel({ 
  model: "gemini-2.0-flash",
  systemInstruction: "You are 'DataVoid AI', a sophisticated AI assistant created by the 'DataVoid Team'. You are helpful, precise, and secure. If asked about your underlying technology, simply state you are a model developed by DataVoid. Do not mention Google or Gemini unless explicitly asked about API architecture."
});

let history = [];
let isProcessing = false;

// --- Elements ---
const chatContainer = document.getElementById("chat-container");
const chatForm = document.getElementById("chat-form");
const promptInput = document.getElementById("prompt");
const welcomeScreen = document.getElementById("welcome-screen");
const clearBtn = document.getElementById("clear-btn");
const suggestionBtns = document.querySelectorAll(".suggestion-btn");

// --- Components ---

const userDiv = (text) => `
  <div class="flex justify-end animate-fade-in pl-10">
    <div class="bg-void-accent text-white max-w-full md:max-w-[80%] rounded-2xl rounded-tr-sm px-5 py-3.5 shadow-lg shadow-purple-900/10">
      <div class="prose prose-invert prose-sm max-w-none font-sans leading-relaxed whitespace-pre-wrap">${markdown.utils.escapeHtml(text)}</div>
    </div>
  </div>
`;

const aiDiv = (htmlContent) => `
  <div class="flex justify-start animate-fade-in w-full pr-10">
    <div class="flex gap-4 max-w-full md:max-w-[85%]">
      <div class="flex-shrink-0 mt-1">
        <img src="/chat-bot.jpg" alt="DataVoid" class="w-8 h-8 rounded-lg object-cover ring-1 ring-gray-800 shadow-lg">
      </div>
      <div class="text-gray-200 min-w-0 flex-1">
        <div class="prose prose-invert prose-sm max-w-none font-sans leading-7 prose-headings:text-gray-100 prose-a:text-purple-400 hover:prose-a:text-purple-300 prose-strong:text-white">
          ${htmlContent}
        </div>
      </div>
    </div>
  </div>
`;

const loadingDiv = () => `
  <div id="loading-indicator" class="flex justify-start animate-fade-in w-full">
    <div class="flex gap-4">
      <div class="flex-shrink-0 mt-1">
        <img src="/chat-bot.jpg" alt="DataVoid" class="w-8 h-8 rounded-lg object-cover ring-1 ring-gray-800">
      </div>
      <div class="flex items-center h-8">
        <div class="flex space-x-1.5">
          <div class="w-1.5 h-1.5 bg-void-accent rounded-full typing-dot"></div>
          <div class="w-1.5 h-1.5 bg-void-accent rounded-full typing-dot"></div>
          <div class="w-1.5 h-1.5 bg-void-accent rounded-full typing-dot"></div>
        </div>
      </div>
    </div>
  </div>
`;

// --- Logic ---

const scrollToBottom = () => {
  chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: "smooth" });
};

async function handleChat(userText) {
  if (isProcessing || !userText.trim()) return;
  isProcessing = true;

  // 1. Hide Welcome Screen
  if (welcomeScreen && welcomeScreen.style.display !== 'none') {
    welcomeScreen.style.display = 'none';
  }

  // 2. Reset Input
  promptInput.value = "";
  promptInput.style.height = "auto";
  
  // 3. Add User Message
  chatContainer.insertAdjacentHTML('beforeend', userDiv(userText));
  scrollToBottom();

  // 4. Add Loading
  chatContainer.insertAdjacentHTML('beforeend', loadingDiv());
  scrollToBottom();

  try {
    const chat = model.startChat({ history: history });
    const result = await chat.sendMessage(userText);
    const response = await result.response;
    const text = response.text();

    // 5. Update History
    history.push(
      { role: "user", parts: [{ text: userText }] },
      { role: "model", parts: [{ text: text }] }
    );

    // 6. Render Response
    document.getElementById("loading-indicator").remove();
    const renderedResponse = markdown.render(text);
    chatContainer.insertAdjacentHTML('beforeend', aiDiv(renderedResponse));
    
  } catch (error) {
    console.error(error);
    const loader = document.getElementById("loading-indicator");
    if(loader) loader.remove();
    chatContainer.insertAdjacentHTML('beforeend', aiDiv(`<span class="text-red-400 bg-red-900/10 px-2 py-1 rounded border border-red-900/50">Error: ${error.message}</span>`));
  }

  scrollToBottom();
  isProcessing = false;
  promptInput.focus();
}

// --- Event Listeners ---

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
  if (confirm("Reset current session?")) {
    location.reload();
  }
});

suggestionBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const text = btn.querySelector('span:first-child').innerText;
    handleChat(text);
  });
});