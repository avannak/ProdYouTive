// Productive keywords
export const productivityKeywords = [
  "tutorial",
  "how-to",
  "lecture",
  "educational",
  "course",
  "training",
  "workshop",
  "seminar",
  "skills",
  "learning",
  "professional development",
  "certification",
  "guide",
  "diy",
  "productivity tips",
  "motivational speech",
  "knowledge",
  "instructional",
  "webinar",
  "web development",
  "programming",
  "coding tutorial",
  "science",
  "mathematics",
  "history",
  "documentary",
  "business strategy",
  "language learning",
  "health and wellness",
  "personal finance",
  "investment",
  "technology review",
  "research",
  "university",
  "college",
  "interview skills",
  "resume building",
  "career advice",
  "time management",
  "productivity tools",
  "mindfulness",
  "yoga",
  "meditation",
  "self-improvement",
  "study techniques",
  "exam preparation",
];

// Distraction keywords
export const distractionKeywords = [
  "funny",
  "prank",
  "comedy",
  "entertainment",
  "vlog",
  "gaming",
  "let's play",
  "music video",
  "viral",
  "challenge",
  "reaction",
  "unboxing",
  "movie review",
  "celebrity",
  "gossip",
  "trailer",
  "haul",
  "asmr",
  "memes",
  "entertainment news",
  "celebrity gossip",
  "reality show",
  "comedy skits",
  "parody",
  "satire",
  "dance challenge",
  "trending dances",
  "lip sync",
  "meme review",
  "pop culture",
  "TV series recap",
  "fantasy sports",
  "sports highlights",
  "fashion and beauty vlog",
  "food challenge",
  "mukbang",
  "travel vlog",
  "pet videos",
  "car reviews",
  "tech unboxing",
  "gadget reviews",
  "video game walkthroughs",
  "role-playing games",
  "virtual reality content",
  "fan theories",
  "superhero movies",
  "anime",
  "scary",
];

export function analyzeVideoForKeywords(videoDetails) {
  let productivityScore = 0;
  let distractionScore = 0;

  const textToAnalyze = `${videoDetails.title} ${
    videoDetails.description
  } ${videoDetails.tags.join(" ")}`.toLowerCase();

  productivityKeywords.forEach((keyword) => {
    if (textToAnalyze.includes(keyword)) productivityScore++;
  });

  distractionKeywords.forEach((keyword) => {
    if (textToAnalyze.includes(keyword)) distractionScore++;
  });
  // will return {"calc productive score", "distraction score"}

  return { productivityScore, distractionScore };
}

// Video Classification Model
export function classifyVideo(videoInfo) {
  let productivityScore = 0;
  let distractionScore = 0;

  // Function to calculate score based on keywords
  function calculateScore(text, keywords) {
    let score = 0;
    keywords.forEach((keyword) => {
      if (text.toLowerCase().includes(keyword)) {
        score += 1; // Increment score for each occurrence
      }
    });
    return score;
  }

  // Analyze video title, description, and tags
  productivityScore += calculateScore(videoInfo.title, productivityKeywords);
  productivityScore += calculateScore(
    videoInfo.description,
    productivityKeywords
  );
  videoInfo.tags.forEach((tag) => {
    productivityScore += calculateScore(tag, productivityKeywords);
  });

  distractionScore += calculateScore(videoInfo.title, distractionKeywords);
  distractionScore += calculateScore(
    videoInfo.description,
    distractionKeywords
  );
  videoInfo.tags.forEach((tag) => {
    distractionScore += calculateScore(tag, distractionKeywords);
  });

  // Determine video category
  if (productivityScore > distractionScore) {
    return "Productive";
  } else if (distractionScore > productivityScore) {
    return "Distracting";
  } else {
    return "Neutral/Inconclusive";
  }
}

export function classifyMultipleVideos(videoDetailsArray) {
  // Array to hold the classification results
  let classifiedVideos = [];

  videoDetailsArray.forEach((video) => {
    // Extract necessary video info
    const videoInfo = {
      title: video.snippet.title,
      description: video.snippet.description,
      tags: video.snippet.tags || [], // Some videos may not have tags
      // ...any other info
    };

    // Classify the video
    const classification = classifyVideo(videoInfo);

    // Add the result to the array
    classifiedVideos.push({
      videoId: video.id,
      title: videoInfo.title,
      classification,
    });
  });

  return classifiedVideos;
}
