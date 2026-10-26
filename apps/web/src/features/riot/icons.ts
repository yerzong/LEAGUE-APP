/** Riot's official CDN for summoner icons. */
export const profileIconUrl = (version: string | null, iconId: number) =>
  version
    ? `https://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon/${String(iconId)}.png`
    : null;
