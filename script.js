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
  storageBucket: "yes24-project.firebasestorage.app",
  messagingSenderId: "157634568906",
  appId: "1:157634568906:web:102a2d0edab4d1da3e4a33",
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
const BOOKS_JSON_URL =
  "https://raw.githubusercontent.com/Divjason/yes24_api/refs/heads/main/books_yes24.json";
const GOODS_JSON_URL =
  "https://raw.githubusercontent.com/Divjason/yes24_api/refs/heads/main/goods_yes24.json";

// Supabase (4번에서 사용) – 실제 값으로 교체
const SUPABASE_URL = "https://qzmrjorvtaoxykzkmbmr.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6bXJqb3J2dGFveHlremttYm1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NTUwNDMsImV4cCI6MjA4MDQzMTA0M30.K5Ng3NVRtqUANWHvEF2QZGR6sY1LRyXND3SQiXytwFM";
const SUPABASE_TABLE = "comments";

// ====== 1. 책 데이터 로드 & 렌더링 ======
let booksData = [];
let goodsData = [];

// 책 카테고리 ↔ 굿즈 카테고리 매핑
const categoryGoodsMap = {
  국내도서_경제경영: "학습/독서",
  국내도서_IT: "디지털",
  국내도서_자기계발: "디자인문구",
};

let selectedBook = null;

async function loadAllData() {
  const [booksRes, goodsRes] = await Promise.all([
    fetch(BOOKS_JSON_URL),
    fetch(GOODS_JSON_URL),
  ]);

  booksData = await booksRes.json();
  goodsData = await goodsRes.json();

  // 🔥 책 데이터 준비된 시점 → 여기서 카테고리 메뉴 생성
  populateCategoryDropdown();

  // 🔥 기본 화면에 책 목록 렌더링
  renderBooks(booksData);
}

window.addEventListener("DOMContentLoaded", loadAllData);

function populateCategoryDropdown() {
  const categorySelect = document.getElementById("categorySelect");
  categorySelect.innerHTML = ""; // 필요하면 기존 옵션 비우기
  const categories = [
    ...new Set(booksData.map((b) => b.category).filter(Boolean)),
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
      <p class="meta">판매가: ${book.list_price || "-"} / 정가: ${
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
  const qRaw = document.getElementById("searchInput").value;
  const q = qRaw.trim().toLowerCase();
  const cat = document.getElementById("categorySelect").value;

  const filtered = booksData.filter((book) => {
    // 카테고리 필터 (value가 "all"인지 ""인지 너 코드 기준에 맞게 조정)
    const inCategory = !cat || cat === "all" ? true : book.category === cat;
    // 검색어: 제목 + 저자 + 출판사 합쳐서 검사
    const text = `${book.title || ""} ${book.author || ""} ${
      book.publisher || ""
    }`.toLowerCase();
    const inSearch = q ? text.includes(q) : true;
    return inCategory && inSearch;
  });

  renderBooks(filtered);
  // 🔥 관련 굿즈 렌더링
  if (q) {
    renderRelatedGoods(q, filtered);
  } else {
    const goodsContainer = document.getElementById("relatedGoods");
    if (goodsContainer) goodsContainer.innerHTML = "";
  }
}

// ====== “검색어 기반 연관 굿즈 10개” 함수 ======
function renderRelatedGoods(keyword, filteredBooks) {
  const container = document.getElementById("relatedGoods");
  if (!container) return;

  container.innerHTML = "";

  if (filteredBooks.length === 0) return;

  const bookCategories = Array.from(
    new Set(filteredBooks.map((b) => b.category))
  );

  bookCategories.forEach((bookCat) => {
    const goodsCat = categoryGoodsMap[bookCat];
    if (!goodsCat) return;

    // 1차: 키워드 매칭
    let related = goodsData.filter(
      (item) =>
        item.category === goodsCat &&
        keyword &&
        item.title &&
        item.title.toLowerCase().includes(keyword.toLowerCase())
    );

    // 2차: 키워드 매칭이 하나도 없으면, 카테고리 전체에서 10개
    if (related.length === 0) {
      related = goodsData.filter((item) => item.category === goodsCat);
    }

    related = related.slice(0, 10);

    if (related.length === 0) return;

    const section = document.createElement("section");
    section.className = "goods-section";

    section.innerHTML = `
      <h3>${bookCat} 검색("${keyword}") 관련 굿즈 – ${goodsCat} 추천</h3>
    `;

    const list = document.createElement("div");
    list.className = "goods-list";

    related.forEach((item) => {
      const card = document.createElement("article");
      card.className = "goods-card";
      card.innerHTML = `
        <a href="${item.detail_url}" target="_blank" rel="noopener noreferrer">
          <img src="${item.thumbnail || ""}" alt="${item.title || ""}" />
          <p class="goods-title">${item.title || ""}</p>
          ${
            item.price
              ? `<p class="goods-price">${item.price.toLocaleString()}원</p>`
              : ""
          }
        </a>
      `;
      list.appendChild(card);
    });

    section.appendChild(list);
    container.appendChild(section);
  });
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

// ====== 내 댓글 단어/감성 분석 유틸 ======
function analyzeComments(text) {
  // 간단 스톱워드 (자유롭게 보완 가능)
  const stopWords = [
    "은",
    "는",
    "이",
    "가",
    "을",
    "를",
    "에",
    "의",
    "와",
    "과",
    "도",
    "으로",
    "에서",
    "입니다",
    "정말",
    "근데",
    "하고",
    "인데",
  ];

  // 아주 가벼운 긍/부정 키워드 (교육용 데모)
  const posWords = [
    "좋",
    "재미있",
    "유익",
    "감동",
    "추천",
    "최고",
    "만족",
    "훌륭",
    "기대", // 기대되요, 기대감, 기대중, 기대합니다…
    "가능", // 가능하다고, 가능할듯, 가능성…
    "정말", // 정말로, 정말이지…
  ];
  const negWords = [
    "별로",
    "지루",
    "최악",
    "실망",
    "아쉽",
    "불편",
    "복잡",
    "싫",
  ];

  // 특수문자 제거 후 공백 기준 토큰화
  const cleaned = text.replace(/[^\p{L}0-9\s]/gu, " ");
  const tokens = cleaned
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w && !stopWords.includes(w));

  const freq = new Map();
  for (const t of tokens) {
    freq.set(t, (freq.get(t) || 0) + 1);
  }

  const topWords = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  let posCount = 0;
  let negCount = 0;
  for (const token of tokens) {
    if (posWords.some((p) => token.includes(p))) posCount++;
    if (negWords.some((n) => token.includes(n))) negCount++;
  }

  return {
    topWords,
    posCount,
    negCount,
    totalWords: tokens.length,
  };
}

// ====== 내 댓글 모달 열기 ======
async function openMyCommentsModal() {
  const user = auth.currentUser;
  if (!user) {
    alert("먼저 GitHub로 로그인 해주세요.");
    return;
  }

  const modal = document.getElementById("myCommentsModal");
  const listEl = document.getElementById("myCommentsList");
  const wordsEl = document.getElementById("myCommentsWords");
  const sentiEl = document.getElementById("myCommentsSentiment");
  const summaryEl = document.getElementById("myCommentsSummary");

  modal.classList.remove("hidden");
  listEl.innerHTML = "<li>내 댓글을 불러오는 중...</li>";
  wordsEl.innerHTML = "";
  sentiEl.textContent = "";
  summaryEl.textContent = "";

  try {
    const url = `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?firebase_uid=eq.${encodeURIComponent(
      user.uid
    )}&order=created_at.desc`;

    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (!res.ok) throw new Error(await res.text());
    const rows = await res.json();

    if (rows.length === 0) {
      listEl.innerHTML = "<li>아직 작성한 댓글이 없습니다.</li>";
      summaryEl.textContent = "작성한 댓글이 없어서 통계를 계산할 수 없습니다.";
      return;
    }

    listEl.innerHTML = "";
    const allText = [];

    rows.forEach((row) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <strong>${row.nickname}</strong>
        <small>${row.book_url || ""}</small>
        <span>${row.comment_text}</span>
      `;
      listEl.appendChild(li);

      if (row.comment_text) allText.push(row.comment_text);
    });

    const joined = allText.join(" ");
    const { topWords, posCount, negCount, totalWords } =
      analyzeComments(joined);

    // 단어 TOP10 렌더링
    wordsEl.innerHTML = "";
    topWords.forEach(([word, count]) => {
      const li = document.createElement("li");
      li.textContent = `${word} (${count})`;
      wordsEl.appendChild(li);
    });

    // 감성 요약
    sentiEl.textContent = `긍정 단어: ${posCount}개, 부정 단어: ${negCount}개`;
    summaryEl.textContent = `총 댓글 ${rows.length}개, 분석된 단어 수: ${totalWords}개`;
  } catch (err) {
    console.error("내 댓글 로드 오류:", err);
    listEl.innerHTML = "<li>댓글을 불러오는 중 오류가 발생했습니다.</li>";
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

// ✅ 내 댓글 모달 토글
const myCommentsToggle = document.getElementById("myCommentsToggle");
const myCommentsModal = document.getElementById("myCommentsModal");
const myCommentsClose = document.getElementById("myCommentsClose");

myCommentsToggle.addEventListener("click", openMyCommentsModal);
myCommentsClose.addEventListener("click", () => {
  myCommentsModal.classList.add("hidden");
});
// 모달 배경 클릭해도 닫히게
myCommentsModal.addEventListener("click", (e) => {
  if (e.target === myCommentsModal) {
    myCommentsModal.classList.add("hidden");
  }
});

// ====== 카메라 열기 / 캡처 / 닫기 로직 추가 ======

const cameraButton = document.getElementById("cameraButton");
const cameraArea = document.getElementById("cameraArea");
const cameraPreview = document.getElementById("cameraPreview");
const captureButton = document.getElementById("captureButton");
const closeCameraButton = document.getElementById("closeCameraButton");

let cameraStream = null; // 현재 웹캠 스트림 저장

// ====== 카메라 켜기 버튼 ======
cameraButton.addEventListener("click", async () => {
  try {
    // 이미 켜져있으면 영역만 보여주고 끝
    if (cameraStream) {
      cameraArea.classList.remove("hidden");
      return;
    }

    // 브라우저에서 카메라 권한 요청
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });

    cameraPreview.srcObject = cameraStream;
    cameraArea.classList.remove("hidden");
  } catch (err) {
    console.error("카메라 접근 실패:", err);
    alert("카메라를 사용할 수 없습니다. 브라우저 권한을 확인해주세요.");
  }
});

// ====== 카메라 끄기 함수 ======
function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
  cameraArea.classList.add("hidden");
}

closeCameraButton.addEventListener("click", stopCamera);

// ====== “촬영” 버튼 → 사진 캡처 + Firebase Storage 업로드 + 채팅 전송 ======
captureButton.addEventListener("click", () => {
  if (!cameraStream) return;

  const user = auth.currentUser;
  if (!user) {
    alert("먼저 GitHub로 로그인 해주세요.");
    return;
  }

  // 비디오 해상도 얻기 (없으면 기본값)
  const track = cameraStream.getVideoTracks()[0];
  const settings = track.getSettings();
  const width = settings.width || 640;
  const height = settings.height || 480;

  // 캔버스에 현재 프레임 그리기
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(cameraPreview, 0, 0, width, height);

  // 캔버스를 Blob(JPEG 이미지)로 변환
  canvas.toBlob(
    async (blob) => {
      if (!blob) return;

      try {
        const filePath = `chatImages/${user.uid}/${Date.now()}_camera.jpg`;
        const storageRef = ref(storage, filePath);

        // 1) Storage에 업로드
        await uploadBytes(storageRef, blob);

        // 2) 다운로드 URL 가져오기
        const imageUrl = await getDownloadURL(storageRef);

        // 3) Firestore에 채팅 메시지 추가 (텍스트 + 이미지)
        const text = chatInput.value; // 선택: 입력창 내용 같이 보낼 수 있음

        await addDoc(messagesRef, {
          user_id: user.uid,
          user_name: user.displayName || user.email,
          text,
          imageUrl,
          created_at: serverTimestamp(),
        });

        chatInput.value = "";
        stopCamera(); // 촬영 후 카메라 닫기
      } catch (err) {
        console.error("촬영 이미지 전송 오류:", err);
        alert("사진을 전송하는 중 오류가 발생했습니다.");
      }
    },
    "image/jpeg",
    0.9
  );
});
