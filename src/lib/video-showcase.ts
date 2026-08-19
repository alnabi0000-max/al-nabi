/**
 * Auth / generate showcase — AI stills with Ken Burns motion.
 * Files live in /public/auth-showcase/.
 */
export type VideoShowcaseExample = {
  id: string;
  beforeImage?: string;
  afterVideo?: string;
  afterPoster?: string;
  promptKey: string;
  titleKey: string;
  description?: string;
};

export const VIDEO_SHOWCASE_EXAMPLES: VideoShowcaseExample[] = [
  {
    id: "fantasy",
    beforeImage: "/auth-showcase/auth-fantasy.png",
    afterPoster: "/auth-showcase/auth-fantasy.png",
    titleKey: "showcase_fantasy",
    promptKey: "showcase_fantasy_prompt",
  },
  {
    id: "comic",
    beforeImage: "/auth-showcase/auth-comic.png",
    afterPoster: "/auth-showcase/auth-comic.png",
    titleKey: "showcase_comic",
    promptKey: "showcase_comic_prompt",
  },
  {
    id: "cartoon",
    beforeImage: "/auth-showcase/auth-cartoon.png",
    afterPoster: "/auth-showcase/auth-cartoon.png",
    titleKey: "showcase_cartoon",
    promptKey: "showcase_cartoon_prompt",
  },
  {
    id: "anime",
    beforeImage: "/auth-showcase/auth-anime.png",
    afterPoster: "/auth-showcase/auth-anime.png",
    titleKey: "showcase_anime",
    promptKey: "showcase_anime_prompt",
  },
  {
    id: "cyberpunk",
    beforeImage: "/auth-showcase/auth-cyberpunk.png",
    afterPoster: "/auth-showcase/auth-cyberpunk.png",
    titleKey: "showcase_cyberpunk",
    promptKey: "showcase_cyberpunk_prompt",
  },
  {
    id: "cinematic",
    beforeImage: "/auth-showcase/auth-cinematic.png",
    afterPoster: "/auth-showcase/auth-cinematic.png",
    titleKey: "showcase_cinematic",
    promptKey: "showcase_cinematic_prompt",
  },
];

export const VIDEO_SHOWCASE_AUTOPLAY_MS = 7000;
