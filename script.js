// script.js (type="module")

// ====== Firebase & Firestore (5번) ======
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GithubAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDSSdMoaKjpVelOp7GwR_QpOOoIWBmaOXk",
  authDomain: "yes24-project.firebaseapp.com",
  projectId: "yes24-project",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GithubAuthProvider();
const db = getFirestore(app);

// ====== GitHub 로그인 상태 관리 ======
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userInfo = document.getElementById("userInfo");
const chatBox = document.getElementById("chatBox");

loginBtn.addEventListener("click", () => {
  signInWithPopup(auth, provider).catch(console.error);
});

logoutBtn.addEventListener("click", () => {
  signOut(auth).catch(console.error);
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    userInfo.textContent = `로그인 사용자: ${user.displayName || user.email}`;
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
    chatBox.style.display = "block";
  } else {
    userInfo.textContent = "로그인하지 않았습니다.";
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    chatBox.style.display = "none";
  }
});

// ====== 채팅 기능 ======
const chatMessages = document.getElementById("chatMessages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");

const messagesRef = collection(db, "messages");
const qMessages = query(messagesRef, orderBy("created_at", "asc"));

onSnapshot(qMessages, (snapshot) => {
  chatMessages.innerHTML = "";
  snapshot.forEach((doc) => {
    const data = doc.data();
    const li = document.createElement("li");
    li.textContent = `${data.user_name}: ${data.text}`;
    chatMessages.appendChild(li);
  });
});

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) {
    alert("먼저 GitHub로 로그인 해주세요.");
    return;
  }

  const text = chatInput.value;
  if (!text.trim()) return;

  await addDoc(messagesRef, {
    user_id: user.uid,
    user_name: user.displayName || user.email,
    text,
    created_at: serverTimestamp(),
  });

  chatInput.value = "";
});

// ====== 0. API & Supabase 설정 ======
const API_URL =
  "https://raw.githubusercontent.com/Divjason/yes24_api/refs/heads/main/books_yes24.json";

// Supabase (4번에서 사용) – 실제 값으로 교체
const SUPABASE_URL = "https://qzmrjorvtaoxykzkmbmr.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6bXJqb3J2dGFveHlremttYm1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NTUwNDMsImV4cCI6MjA4MDQzMTA0M30.K5Ng3NVRtqUANWHvEF2QZGR6sY1LRyXND3SQiXytwFM";
const SUPABASE_TABLE = "comments";

// ====== 1. 책 데이터 로드 & 렌더링 ======
let allBooks = [];
let selectedBook = null;

async function loadBooks() {
  const res = await fetch(API_URL);
  allBooks = await res.json();
  populateCategoryDropdown();
  renderBooks(allBooks);
}

function populateCategoryDropdown() {
  const categorySelect = document.getElementById("categorySelect");
  const categories = [
    ...new Set(allBooks.map((b) => b.category).filter(Boolean)),
  ];
  categories.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    categorySelect.appendChild(opt);
  });
}

function renderBooks(books) {
  const listEl = document.getElementById("bookList");
  listEl.innerHTML = "";

  books.forEach((book) => {
    const card = document.createElement("article");
    card.className = "book-card";

    const url = book.detail_url || "#";

    card.innerHTML = `
      <a href="${url}" target="_blank" rel="noopener noreferrer">
        <img src="${book.thumbnail || ""}" alt="${book.title || ""}" />
      </a>
      <h3>
        <a href="${url}" target="_blank" rel="noopener noreferrer">
          ${book.title || "제목 없음"}
        </a>
      </h3>
      <p class="meta">${book.author || "저자 미상"} | ${
      book.publisher || ""
    }</p>
      <p class="meta">정가: ${book.list_price || "-"} / 판매가: ${
      book.sale_price || "-"
    }</p>
      <p class="meta">카테고리: ${book.category || ""} | 재고: ${
      book.stock || ""
    }</p>
      <button type="button">댓글 보기</button>
    `;

    const btn = card.querySelector("button");
    btn.addEventListener("click", () => openCommentSection(book));

    listEl.appendChild(card);
  });
}

function applyFilters() {
  const q = document.getElementById("searchInput").value.toLowerCase();
  const cat = document.getElementById("categorySelect").value;

  const filtered = allBooks.filter((book) => {
    const inCategory = cat ? book.category === cat : true;
    const text = `${book.title || ""} ${book.author || ""} ${
      book.publisher || ""
    }`.toLowerCase();
    const inSearch = text.includes(q);
    return inCategory && inSearch;
  });

  renderBooks(filtered);
}

// ====== 2. 댓글 영역 (Supabase 사용) ======
function openCommentSection(book) {
  selectedBook = book;
  document.getElementById(
    "commentBookTitle"
  ).textContent = `댓글 - ${book.title}`;
  loadComments(book);
}

// 댓글 조회
async function loadComments(book) {
  const listEl = document.getElementById("commentList");
  listEl.innerHTML = "<li>댓글 불러오는 중...</li>";

  try {
    const url = `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?book_url=eq.${encodeURIComponent(
      book.detail_url
    )}&order=created_at.desc`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    const rows = await res.json();
    listEl.innerHTML = "";
    if (rows.length === 0) {
      listEl.innerHTML = "<li>첫 번째 댓글을 남겨보세요 😊</li>";
    } else {
      rows.forEach((row) => {
        const li = document.createElement("li");
        li.textContent = `${row.nickname} : ${row.comment_text}`;
        listEl.appendChild(li);
      });
    }
  } catch (err) {
    console.error(err);
    listEl.innerHTML = "<li>댓글을 불러오는 중 오류가 발생했습니다.</li>";
  }
}

// 댓글 등록
async function submitComment(e) {
  e.preventDefault();
  if (!selectedBook) {
    alert("먼저 책을 선택해주세요.");
    return;
  }

  const nickname = document.getElementById("commentNickname").value;
  const text = document.getElementById("commentText").value;

  const payload = {
    book_url: selectedBook.detail_url,
    nickname,
    comment_text: text,
  };

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error("댓글 저장 실패");

    document.getElementById("commentText").value = "";
    await loadComments(selectedBook);
  } catch (err) {
    console.error(err);
    alert("댓글 저장 중 오류가 발생했습니다.");
  }
}

// ====== 3. 이벤트 바인딩 ======
document.getElementById("searchInput").addEventListener("input", applyFilters);
document
  .getElementById("categorySelect")
  .addEventListener("change", applyFilters);
document
  .getElementById("commentForm")
  .addEventListener("submit", submitComment);

// 초기 로딩
loadBooks();
