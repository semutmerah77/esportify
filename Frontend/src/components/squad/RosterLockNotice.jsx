import Icon from "../icon";

function RosterLockNotice() {
  return (
    <div className="sq-lock-notice" role="note">
      <span className="sq-lock-ic">
        <Icon name="lock" size={16} />
      </span>
      <div>
        <b>Roster Lock Aktif</b>
        <p>
          Squad ini telah terdaftar sebagai peserta turnamen aktif. Anggota
          tidak dapat ditambahkan hingga seluruh rangkaian turnamen selesai.
        </p>
      </div>
    </div>
  );
}

export default RosterLockNotice;
