  // ===== 공통 유틸리티 (Login/Student/Teacher 페이지 공용) =====

  /**
   * 서버 함수 호출 (예전 google.script.run 대체).
   * /api/rpc 로 { fn, args } 를 보내고, 서버가 돌려준 result를 반환한다.
   */
  async function runServer(fnName) {
    var args = Array.prototype.slice.call(arguments, 1);
    var res;
    try {
      res = await fetch('/api/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fn: fnName, args: args })
      });
    } catch (e) {
      throw new Error('서버에 연결하지 못했습니다. 인터넷 연결을 확인해주세요.');
    }
    var data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok || !data || data.error) {
      throw new Error((data && data.error) || ('서버 오류 (' + res.status + ')'));
    }
    return data.result;
  }

  /** 같은 사이트 안에서 다른 화면으로 이동. (login -> /, student -> /student.html, teacher -> /teacher.html) */
  function goToPage(page) {
    var paths = { login: '/', student: '/student.html', teacher: '/teacher.html' };
    window.location.href = paths[page] || '/';
  }

  function getSession() {
    try {
      var raw = sessionStorage.getItem('musun_user');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setSession(user) {
    try {
      sessionStorage.setItem('musun_user', JSON.stringify(user));
    } catch (e) {
      /* 세션 저장이 불가능한 환경이면 무시 */
    }
  }

  function clearSession() {
    try {
      sessionStorage.removeItem('musun_user');
    } catch (e) {}
  }

  function logout() {
    clearSession();
    goToPage('login');
  }

  function showSpinner(show) {
    var el = document.getElementById('spinner');
    if (el) el.classList.toggle('hidden', !show);
  }

  function showMsg(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.className = 'msg ' + (type || 'error');
  }

  function hideMsg(el) {
    if (!el) return;
    el.className = 'msg hidden';
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /**
   * 사진 파일을 태블릿/서버 부담이 적도록 줄여서(최대 1024px, JPEG 70%)
   * base64 문자열로 변환한다.
   * 반환값: { base64, mime }
   */
  function compressImageToBase64(file) {
    var MAX_SIZE = 1024;
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('사진을 읽는 중 오류가 발생했습니다.')); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('사진을 불러오지 못했습니다.')); };
        img.onload = function () {
          var w = img.width, h = img.height;
          if (w > h && w > MAX_SIZE) { h = Math.round((h * MAX_SIZE) / w); w = MAX_SIZE; }
          else if (h > MAX_SIZE) { w = Math.round((w * MAX_SIZE) / h); h = MAX_SIZE; }

          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);

          var dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          var base64 = dataUrl.split(',')[1];
          resolve({ base64: base64, mime: 'image/jpeg' });
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }
