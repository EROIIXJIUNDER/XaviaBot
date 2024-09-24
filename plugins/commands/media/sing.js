import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { getStreamFromURL, shortenURL, randomString } from global.utils;

const config = {
    name: "sing",
    aliases: ["play"],
    description: "Play audio from YouTube with audio recognition support.",
    usage: "[video name] / [reply to audio/video]",
    cooldown: 10,
    permissions: [0], // 0: Member
    isAbsolute: false,
    isHidden: false,
    credits: "Asmit",
}

const langData = {
    "en": {
        "missingArgs": "Please provide a video name or reply to a video/audio attachment.",
        "noVideoFound": "No video found for the given query.",
        "errorDownload": "Error downloading the video.",
        "downloadFail": "Failed to retrieve download link for the video.",
        "invalidAttachment": "Invalid attachment type.",
        "processing": "Processing your request...",
        "success": "Here is your audio!"
    },
    // Add more languages here if needed
}

async function onCall({ message, args, getLang, extra, data, userPermissions, prefix, api, event }) {
    message.send(getLang("processing"));

    try {
        let title = '';
        let shortUrl = '';
        let videoId = '';

        const extractShortUrl = async () => {
            const attachment = event.messageReply.attachments[0];
            if (attachment.type === "video" || attachment.type === "audio") {
                return attachment.url;
            } else {
                throw new Error(getLang("invalidAttachment"));
            }
        };

        if (event.messageReply && event.messageReply.attachments && event.messageReply.attachments.length > 0) {
            // If user replied to a video or audio attachment
            shortUrl = await extractShortUrl();
            const musicRecognitionResponse = await axios.get(`https://audio-recon-ahcw.onrender.com/kshitiz?url=${encodeURIComponent(shortUrl)}`);
            title = musicRecognitionResponse.data.title;

            const searchResponse = await axios.get(`https://youtube-kshitiz.vercel.app/youtube?search=${encodeURIComponent(title)}`);
            if (searchResponse.data.length > 0) {
                videoId = searchResponse.data[0].videoId;
            }

            shortUrl = await shortenURL(shortUrl);

        } else if (args.length === 0) {
            // If no arguments are provided
            message.reply(getLang("missingArgs"));
            return;
        } else {
            // Search for the video based on the argument
            title = args.join(" ");
            const searchResponse = await axios.get(`https://youtube-kshitiz.vercel.app/youtube?search=${encodeURIComponent(title)}`);
            if (searchResponse.data.length > 0) {
                videoId = searchResponse.data[0].videoId;
            }

            const videoUrlResponse = await axios.get(`https://youtube-kshitiz.vercel.app/download?id=${encodeURIComponent(videoId)}`);
            if (videoUrlResponse.data.length > 0) {
                shortUrl = await shortenURL(videoUrlResponse.data[0]);
            }
        }

        if (!videoId) {
            message.reply(getLang("noVideoFound"));
            return;
        }

        const downloadResponse = await axios.get(`https://youtube-kshitiz.vercel.app/download?id=${encodeURIComponent(videoId)}`);
        const videoUrl = downloadResponse.data[0];

        if (!videoUrl) {
            message.reply(getLang("downloadFail"));
            return;
        }

        const writer = fs.createWriteStream(path.join(process.cwd(), "cache", `${videoId}.mp3`));
        const response = await axios({
            url: videoUrl,
            method: 'GET',
            responseType: 'stream'
        });

        response.data.pipe(writer);

        writer.on('finish', () => {
            const videoStream = fs.createReadStream(path.join(process.cwd(), "cache", `${videoId}.mp3`));
            message.reply({ body: getLang("success"), attachment: videoStream });
        });

        writer.on('error', (error) => {
            console.error("Error:", error);
            message.reply(getLang("errorDownload"));
        });
    } catch (error) {
        console.error("Error:", error);
        message.reply(getLang("errorDownload"));
    }
}

export default {
    config,
    langData,
    onCall
}
