/** Escapes LIKE wildcards in user input. */
export const likeEscape = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);
