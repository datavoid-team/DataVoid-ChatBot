import { GoogleGenerativeAI } from "@google/generative-ai";
import md from "markdown-it";
import hljs from "highlight.js";

// Initialize markdown parser with highlight.js integration
const markdown = md({
  html: true,
  linkify: true,
  typographer: true,
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs p-4 rounded-md text-sm"><code>${
          hljs.highlight(str, { language: lang, ignoreIllegals: true }).value
        }</code></pre>`;
      } catch (__) {}
    }
    return `<pre class="hljs p-4 rounded-md text-sm"><code>${markdown.utils.escapeHtml(str)}</code></pre>`;
  },
});

// Configuration
const API_KEY = import.meta.env.VITE_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// State
let history = [];
let isProcessing = false;

// DOM Elements
const chatContainer = document.getElementById("chat-container");
const chatForm = document.getElementById("chat-form");
const promptInput = document.getElementById("prompt");
const welcomeMessage = document.getElementById("welcome-message");
const clearBtn = document.getElementById("clear-btn");
const suggestionBtns = document.querySelectorAll(".suggestion-btn");

// Helper: Scroll to bottom
const scrollToBottom = () => {
  chatContainer.scrollTo({
    top: chatContainer.scrollHeight,
    behavior: "smooth",
  });
};

// Component: User Message
const userDiv = (text) => `
  <div class="flex justify-end mb-6 animate-fade-in">
    <div class="bg-gray-800 text-gray-100 max-w-[85%] rounded-2xl rounded-tr-sm px-5 py-3.5 shadow-md border border-gray-700">
      <div class="prose prose-invert prose-sm max-w-none leading-relaxed whitespace-pre-wrap">${markdown.utils.escapeHtml(text)}</div>
    </div>
  </div>
`;

// Component: AI Message
const aiDiv = (htmlContent) => `
  <div class="flex justify-start mb-6 animate-fade-in w-full">
    <div class="flex gap-3 max-w-[90%] md:max-w-[85%]">
      <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-blue-600 flex-shrink-0 flex items-center justify-center shadow-md">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <div class="text-gray-200 rounded-2xl rounded-tl-sm px-1 py-1">
        <div class="prose prose-invert prose-p:leading-relaxed prose-pre:bg-[#1e1e1e] prose-pre:border prose-pre:border-gray-700 max-w-none">
          ${htmlContent}
        </div>
      </div>
    </div>
  </div>
`;

// Component: Loading Indicator
const loadingDiv = () => `
  <div id="loading-indicator" class="flex justify-start mb-6 animate-fade-in">
    <div class="flex gap-3">
      <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-blue-600 flex-shrink-0 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <div class="bg-gray-800/50 h-10 px-4 rounded-full flex items-center gap-1.5 border border-gray-700/50">
        <span class="w-2 h-2 bg-gray-400 rounded-full typing-dot"></span>
        <span class="w-2 h-2 bg-gray-400 rounded-full typing-dot"></span>
        <span class="w-2 h-2 bg-gray-400 rounded-full typing-dot"></span>
      </div>
    </div>
  </div>
`;

// Function to handle chat logic
async function handleChat(userText) {
  if (isProcessing || !userText.trim()) return;
  isProcessing = true;

  // UI Updates
  if (welcomeMessage) welcomeMessage.style.display = 'none';
  promptInput.value = "";
  promptInput.style.height = "auto";
  
  // Add User Message
  chatContainer.insertAdjacentHTML('beforeend', userDiv(userText));
  scrollToBottom();

  // Add Loading
  chatContainer.insertAdjacentHTML('beforeend', loadingDiv());
  scrollToBottom();

  try {
    const chat = model.startChat({ history: history });
    const result = await chat.sendMessage(userText);
    const response = await result.response;
    const text = response.text();

    // Update History (Format strictly for next turn if needed, though SDK handles memory in 'chat' object usually)
    // Note: The SDK 'chat' object maintains history state for the session, 
    // but if we reload we lose it. Here we push to our local array just in case we need to debug.
    history.push(
      { role: "user", parts: [{ text: userText }] },
      { role: "model", parts: [{ text: text }] }
    );

    // Remove Loading and Add Response
    document.getElementById("loading-indicator").remove();
    const renderedResponse = markdown.render(text);
    chatContainer.insertAdjacentHTML('beforeend', aiDiv(renderedResponse));
    
  } catch (error) {
    console.error(error);
    document.getElementById("loading-indicator").remove();
    chatContainer.insertAdjacentHTML('beforeend', aiDiv(`<span class="text-red-400">Error: ${error.message}. Please try again.</span>`));
  }

  scrollToBottom();
  isProcessing = false;
  promptInput.focus();
}

// Event Listeners
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

// Auto-resize textarea
promptInput.addEventListener("input", function() {
  this.style.height = "auto";
  this.style.height = (this.scrollHeight) + "px";
  if(this.value === '') this.style.height = 'auto';
});

// Clear Chat
clearBtn.addEventListener("click", () => {
  if(confirm("Start a new chat? This will clear history.")) {
    history = [];
    location.reload(); // Simple reload to clear state and bring back welcome message
  }
});

// Suggestion Buttons
suggestionBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const text = btn.querySelector('span:first-child').innerText;
    handleChat(text);
  });
});
