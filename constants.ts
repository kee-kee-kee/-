
export const NARRATIONS = {
  INTRO: "これから英語の聞き取り試験を始めます。試験時間は約30分です。",
  OUTRO: "以上で試験を終わります。解答をやめてください。",
  PART_GENERIC: (label: string, type: string) => 
    `Part ${label}。これから放送するのは、${type === 'lecture' ? '講義' : '討論'}です。2回放送されます。1回目の放送の30秒後に2回目を放送します。メモを取っても構いません。`,
  SECOND_LAP: "2回目の放送を開始します。"
};

export const SAMPLE_URLS = [
  "https://www.youtube.com/watch?v=_GI9-J-sE5k", // Example academic lecture
  "https://www.youtube.com/watch?v=9P_Ah0S-p_Y", // Example discussion
  "https://www.youtube.com/watch?v=W6vA0vU0X7s"  // Example news
];
