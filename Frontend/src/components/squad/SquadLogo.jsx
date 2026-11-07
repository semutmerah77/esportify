import Icon from "../icon";

// Logo squad: gambar kalau ada, kalau tidak kotak berwarna dengan ikon.
function SquadLogo({ squad, size = 48 }) {
  const iconSize = Math.round(size * 0.46);
  return (
    <span
      className={`sq-logo ${squad.logo ? "" : squad.tone || "blue"}`}
      style={{ width: size, height: size }}
    >
      {squad.logo ? (
        <img src={squad.logo} alt="" />
      ) : (
        <Icon name={squad.icon || "shield"} size={iconSize} />
      )}
    </span>
  );
}

export default SquadLogo;
