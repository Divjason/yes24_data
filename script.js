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
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDSSdMoaKjpVelOp7GwR_QpOOoIWBmaOXk",
  authDomain: "yes24-project.firebaseapp.com",
  projectId: "yes24-project",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GithubAuthProvider();
const db = getFirestore(app);
const storage = getStorage(app);

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

    let html = `<strong>${data.user_name}</strong>: ${data.text || ""}`;

    if (data.imageUrl) {
      html += `<br /><img src="${data.imageUrl}" alt="image" style="max-width:200px; border-radius:8px; margin-top:4px;" />`;
    }

    li.innerHTML = html;
    chatMessages.appendChild(li);
  });
});

const chatImageInput = document.getElementById("chatImage");

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) {
    alert("먼저 GitHub로 로그인 해주세요.");
    return;
  }

  const text = chatInput.value;
  const file = chatImageInput.files[0];

  if (!text.trim() && !file) {
    // 텍스트도 이미지도 없으면 패스
    return;
  }

  let imageUrl = null;

  try {
    // 1) 이미지가 있으면 먼저 Storage에 업로드
    if (file) {
      const filePath = `chatImages/${user.uid}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, filePath);
      await uploadBytes(storageRef, file);
      imageUrl = await getDownloadURL(storageRef);
    }

    // 2) Firestore에 메시지 + imageUrl 저장
    await addDoc(messagesRef, {
      user_id: user.uid,
      user_name: user.displayName || user.email,
      text,
      imageUrl, // 없으면 null
      created_at: serverTimestamp(),
    });

    chatInput.value = "";
    chatImageInput.value = "";
  } catch (err) {
    console.error("채팅 저장 오류:", err);
    alert("메시지를 전송하는 중 오류가 발생했습니다.");
  }
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

// 댓글 삭제
async function deleteComment(id) {
  if (!confirm("정말 이 댓글을 삭제할까요?")) return;

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?id=eq.${id}`,
    {
      method: "DELETE",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: "return=minimal",
      },
    }
  );

  if (!res.ok) {
    console.error("삭제 실패", await res.text());
    alert("댓글 삭제 중 오류가 발생했습니다.");
    return;
  }
  await loadComments(selectedBook); // 목록 다시 불러오기
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

    const user = auth.currentUser;

    if (rows.length === 0) {
      listEl.innerHTML = "<li>첫 번째 댓글을 남겨보세요 😊</li>";
    } else {
      rows.forEach((row) => {
        const li = document.createElement("li");
        let html = `<strong>${row.nickname}</strong> : ${row.comment_text}`;
        // 로그인 되어 있고, 내 uid와 같으면 삭제 버튼 노출
        if (user && row.firebase_uid === user.uid) {
          html += ` <button type="button" class="delete-comment" data-id="${row.id}">삭제</button>`;
        }

        li.innerHTML = html;
        listEl.appendChild(li);
      });

      // 삭제 버튼 이벤트 바인딩
      listEl.querySelectorAll(".delete-comment").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-id");
          deleteComment(id);
        });
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

  const user = auth.currentUser; // Firebase 로그인 유저
  if (!user) {
    alert("댓글을 남기려면 먼저 GitHub로 로그인 해주세요.");
    return;
  }

  const nickname = document.getElementById("commentNickname").value;
  const text = document.getElementById("commentText").value;

  const payload = {
    book_url: selectedBook.detail_url,
    nickname,
    comment_text: text,
    firebase_uid: user.uid,
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
