import PixelIcon from './PixelIcon.jsx';

// 화분에 찾아온 방문객. 두 프레임을 번갈아 보여 날갯짓하고, 종류마다 다른 길로 움직인다.
// 클릭하면 onCatch (위젯 창은 .interactive 위에서만 클릭을 받는다)
const FRAMES = {
  butterfly: ['butterflyA', 'butterflyB'],
  rainbow: ['rainbowA', 'rainbowB'],
  bee: ['beeA', 'beeB'],
  ladybug: ['ladybugA', 'ladybugB'],
  sparrow: ['sparrowA', 'sparrowB'],
  firefly: ['fireflyA', 'fireflyB'],
};

export default function Visitor({ kind, label, onCatch }) {
  const [a, b] = FRAMES[kind];
  return (
    <button type="button" className={`visitor visitor-${kind} interactive`} onClick={onCatch} title={label} aria-label={label}>
      <span className="visitor-path">
        <PixelIcon name={a} scale={2} className="visitor-frame vf-a" />
        <PixelIcon name={b} scale={2} className="visitor-frame vf-b" />
      </span>
    </button>
  );
}
