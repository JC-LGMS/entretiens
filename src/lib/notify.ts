export function shouldShowNotification(profileId: string | null, muted: boolean): boolean {
  return profileId !== null && profileId !== '' && !muted
}
