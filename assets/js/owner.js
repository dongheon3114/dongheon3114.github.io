// 주인 전용 버튼(글쓰기·메뉴 편집·수정·삭제) — 연결 설정(토큰)을 해둔 기기에서만 보입니다.
(function () {
  if (!window.GH || !GH.token()) return;
  document.querySelectorAll(".owner-only").forEach(function (el) { el.hidden = false; });

  var box = document.querySelector(".owner-tools");
  if (!box) return;
  box.hidden = false;

  var status = box.querySelector(".owner-status");
  var del = box.querySelector(".js-delete");
  if (!del) return;

  var path = box.getAttribute("data-path");
  var prefix = box.getAttribute("data-delete-prefix"); // 책 삭제 시 함께 지울 장들 (예: "_book/b-xxx-")
  var after = box.getAttribute("data-after") || document.body.getAttribute("data-home") || "/";
  var ask = box.getAttribute("data-confirm") || "이 글을 삭제할까요?\n삭제하면 블로그에서 사라져요.";

  del.addEventListener("click", function () {
    del.disabled = true;
    var extra = prefix
      ? GH.listDir(prefix.slice(0, prefix.lastIndexOf("/"))).then(function (ps) {
          return ps.filter(function (p) { return p.indexOf(prefix) === 0; });
        })
      : Promise.resolve([]);
    extra.then(function (more) {
      var msg = more.length ? ask + "\n(이 책의 장 " + more.length + "개도 함께 삭제돼요)" : ask;
      if (!confirm(msg)) { del.disabled = false; return; }
      status.textContent = "삭제하는 중…";
      var changes = [{ path: path, remove: true }].concat(more.map(function (p) { return { path: p, remove: true }; }));
      return GH.commit(changes, "삭제: " + path).then(function () {
        status.textContent = "삭제했어요. 1~2분 뒤 블로그에서 사라져요.";
        setTimeout(function () { location.href = after; }, 2500);
      });
    }).catch(function (e) {
      status.textContent = GH.message(e);
      del.disabled = false;
    });
  });
})();
