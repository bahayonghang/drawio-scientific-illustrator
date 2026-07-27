export const BACKUP_SUFFIX = ".drawio-install.bak";

export function backupPathFor(file) {
  return `${file}${BACKUP_SUFFIX}`;
}
