// 글 페이지의 수정/삭제 버튼 — 연결 설정(토큰)을 해둔 기기에서만 보입니다.
(function () {
  var token = null;
  try { token = localStorage.getItem("blog-token"); } catch (e) {}
  var box = document.querySelector(".owner-tools");
  if (!box || !token) return;
  box.hidden = false;

  var b = document.body;
  var USER = b.getAttribute("data-user");
  var REPO = b.getAttribute("data-repo");
  var BRANCH = b.getAttribute("data-branch") || "main";
  var HOME = b.getAttribute("data-home") || "/";
  var path = box.getAttribute("data-path");
  var status = box.querySelector(".owner-status");
  var del = box.querySelector(".js-delete");

  function encPath(p) { return p.split("/").map(encodeURIComponent).join("/"); }

  del.addEventListener("click", function () {
    if (!confirm("이 글을 삭제할까요?\n삭제하면 블로그에서 사라져요.")) return;
    var api = "https://api.github.com/repos/" + USER + "/" + REPO + "/contents/" + encPath(path);
    var headers = { "Authorization": "Bearer " + token, "Accept": "application/vnd.github+json" };
    del.disabled = true;
    status.textContent = "삭제하는 중…";
    fetch(api + "?ref=" + BRANCH, { headers: headers })
      .then(function (r) {
        if (r.status === 404) throw { msg: "이미 삭제된 글이에요. 잠시 뒤 블로그에서도 사라져요." };
        if (r.status === 401) throw { msg: "토큰이 맞지 않거나 만료됐어요. 글쓰기 화면의 연결 설정을 확인해 주세요." };
        if (!r.ok) throw { msg: "글 정보를 가져오지 못했어요 (오류 " + r.status + ")." };
        return r.json();
      })
      .then(function (d) {
        return fetch(api, {
          method: "DELETE", headers: headers,
          body: JSON.stringify({ message: "글 삭제: " + path, sha: d.sha, branch: BRANCH })
        });
      })
      .then(function (r) {
        if (r.status === 403) throw { msg: "토큰에 삭제 권한이 없어요." };
        if (!r.ok) throw { msg: "삭제하지 못했어요 (오류 " + r.status + ")." };
        status.textContent = "삭제했어요. 1~2분 뒤 블로그에서 사라져요. 첫 화면으로 이동할게요.";
        setTimeout(function () { location.href = HOME; }, 2500);
      })
      .catch(function (e) {
        status.textContent = e && e.msg ? e.msg : "인터넷 연결을 확인해 주세요.";
        del.disabled = false;
      });
  });
})();
