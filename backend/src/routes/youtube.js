const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { fetchYoutube } = require("../lib/youtubeKeys");
const { youtubeLimiter } = require("../middleware/rateLimits");

const router = express.Router();
router.use(requireAuth);
router.use(youtubeLimiter);

const ORDER_MAP = {
  relevance: "relevance",
  viewCount: "viewCount",
  date: "date",
  subscriberCount: "relevance", // YouTube search has no subscriberCount order; sorted client-side after channels.list
};

// ISO 8601 duration like "PT8M35S" -> total seconds.
function durationToSeconds(iso) {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || "");
  if (!m) return 0;
  const [, h, mi, s] = m;
  return (Number(h) || 0) * 3600 + (Number(mi) || 0) * 60 + (Number(s) || 0);
}

function publishedAfterParam(timeValue) {
  const now = Date.now();
  const days = { week: 7, month: 30, year: 365, year3: 365 * 3, year5: 365 * 5 }[timeValue];
  if (!days) return null;
  return new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
}

function bestThumbnail(thumbnails) {
  if (!thumbnails) return null;
  const best = thumbnails.maxres || thumbnails.high || thumbnails.medium || thumbnails.default;
  return best ? best.url : null;
}

async function attachChannelInfo(videos) {
  const channelIds = [...new Set(videos.map((v) => v.channelId).filter(Boolean))];
  if (!channelIds.length) return videos;

  const channelsUrl =
    `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics` +
    `&id=${encodeURIComponent(channelIds.join(","))}`;
  const channelsData = await fetchYoutube(channelsUrl, 1);
  const channelById = new Map((channelsData.items || []).map((c) => [c.id, c]));

  return videos.map((v) => {
    const c = channelById.get(v.channelId);
    return {
      ...v,
      channelAvatar: c ? bestThumbnail(c.snippet?.thumbnails) : null,
      subscriberCount: Number(c?.statistics?.subscriberCount || 0),
    };
  });
}

router.get("/search", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return res.status(400).json({ error: "q is required" });

    const order = ORDER_MAP[req.query.order] || "relevance";
    const hideShorts = req.query.hideShorts === "true";
    const pageToken = req.query.pageToken || "";
    const publishedAfter = publishedAfterParam(req.query.time);

    // search.list costs a flat 100 quota units regardless of maxResults, so
    // asking for the API's max (50) instead of a smaller page gets twice as
    // many candidates per unit spent - fewer follow-up pages needed overall,
    // especially once hideShorts below filters a chunk of them back out.
    let searchUrl =
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=50` +
      `&order=${encodeURIComponent(order)}&q=${encodeURIComponent(q)}`;
    if (publishedAfter) searchUrl += `&publishedAfter=${encodeURIComponent(publishedAfter)}`;
    if (pageToken) searchUrl += `&pageToken=${encodeURIComponent(pageToken)}`;

    const searchData = await fetchYoutube(searchUrl, 100);
    const videoIds = (searchData.items || []).map((it) => it.id.videoId).filter(Boolean);

    if (!videoIds.length) {
      return res.json({ videos: [], nextPageToken: searchData.nextPageToken || "" });
    }

    const videosUrl =
      `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails,snippet` +
      `&id=${encodeURIComponent(videoIds.join(","))}`;
    const videosData = await fetchYoutube(videosUrl, Math.ceil(videoIds.length / 50) + 1);

    let videos = (videosData.items || []).map((v) => ({
      id: v.id,
      title: v.snippet?.title,
      channelId: v.snippet?.channelId,
      channelTitle: v.snippet?.channelTitle,
      publishedAt: v.snippet?.publishedAt,
      thumbUrl: bestThumbnail(v.snippet?.thumbnails),
      viewCount: Number(v.statistics?.viewCount || 0),
      duration: v.contentDetails?.duration,
    }));

    if (hideShorts) {
      videos = videos.filter((v) => durationToSeconds(v.duration) >= 480);
    }

    videos = await attachChannelInfo(videos);

    if (req.query.order === "subscriberCount") {
      videos.sort((a, b) => (b.subscriberCount || 0) - (a.subscriberCount || 0));
    }

    res.json({ videos, nextPageToken: searchData.nextPageToken || "" });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Used by the Preview tab's "load trending" shortcut, so a user can drop
// their own design into a ring of real competitor thumbnails without having
// to search for a topic first.
router.get("/trending", async (req, res) => {
  try {
    // videos.list costs a flat 1 unit no matter how many results come back,
    // so there's no reason not to ask for the max here too.
    const url =
      "https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails" +
      "&chart=mostPopular&regionCode=US&maxResults=50";
    const data = await fetchYoutube(url, 1);

    let videos = (data.items || []).map((v) => ({
      id: v.id,
      title: v.snippet?.title,
      channelId: v.snippet?.channelId,
      channelTitle: v.snippet?.channelTitle,
      publishedAt: v.snippet?.publishedAt,
      thumbUrl: bestThumbnail(v.snippet?.thumbnails),
      viewCount: Number(v.statistics?.viewCount || 0),
      duration: v.contentDetails?.duration,
    }));

    videos = await attachChannelInfo(videos);
    res.json({ videos });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
