// 새 버전 확인: GitHub Releases 의 최신 버전 번호만 가져와 비교한다 (서버·비용 없음, 개인 정보 전송 없음).
//  - Windows: electron-updater 가 같은 Releases 에서 설치 파일까지 받아 다음 재시작 때 적용
//  - Mac: Apple 유료 서명 없이는 자동 교체가 막혀 있어서, 새 버전을 알려 주고 다운로드 페이지를 연다
const REPO = 'kangabee/desktop-flower-garden';
const DOWNLOAD_PAGE = 'https://kangabee.github.io/desktop-flower-garden/';

const parse = (v) => String(v).replace(/^v/, '').split('-')[0].split('.').map((n) => parseInt(n, 10) || 0);

/** a 가 b 보다 높은 버전인가 (예: '0.5.0' > '0.4.0') */
function isNewer(a, b) {
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < 3; i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  }
  return false;
}

/** 지금보다 새 버전이 있으면 그 버전 번호, 없거나 확인 실패면 null */
async function checkForNewVersion(current) {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'DesktopFlowerGarden' },
    });
    if (!res.ok) return null;
    const { tag_name: tag } = await res.json();
    return tag && isNewer(tag, current) ? tag.replace(/^v/, '') : null;
  } catch {
    return null; // 오프라인 등은 조용히 다음 확인 때 다시
  }
}

module.exports = { DOWNLOAD_PAGE, isNewer, checkForNewVersion };
