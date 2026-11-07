import { useEffect, useState } from "react";
import Icon from "../icon";

// Logo squad: gambar dari BE (logo_url). Kalau kosong atau gagal dimuat,
// tampil kotak berwarna dengan ikon (icon & tone hanya dekorasi FE).
function SquadLogo({ squad, size = 48 }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [squad.logo]);

  const showImage = squad.logo && !failed;
  const iconSize = Math.round(size * 0.46);

  return (
    <span
      className={`sq-logo ${showImage ? "" : squad.tone || "blue"}`}
      style={{ width: size, height: size }}
    >
      {showImage ? (
        <img src={squad.logo} alt="" onError={() => setFailed(true)} />
      ) : (
        <Icon name={squad.icon || "shield"} size={iconSize} />
      )}
    </span>
  );
}

export default SquadLogo;
