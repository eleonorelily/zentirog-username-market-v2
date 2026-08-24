const DRAGON_GIF_URL =
  'https://giffiles.alphacoders.com/207/207669.gif';

const DragonScene = () => {
  return (
    <div className="dragon-stage" aria-hidden="true">
      <div className="dragon-gif-aura" />
      <img
        src={DRAGON_GIF_URL}
        alt=""
        className="dragon-gif"
        loading="eager"
        draggable={false}
      />
      <div className="dragon-shadow" />
    </div>
  );
};

export default DragonScene;
