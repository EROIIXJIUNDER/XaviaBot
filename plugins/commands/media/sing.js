import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { getStreamFromURL, shortenURL } from '../../utils/index.js';

const config = {
    name: "sing",
    aliases: ["audio"],
    description: "Play audio from YouTube with support for audio recognition",
    usage: "[query] or reply to an audio/video",
    cooldown: 10,
    permissions: [0, 1, 2],
    isAbsolute: false,
    isHidden: false,
    credits: "Asmit"
};

const langData = {
    "en_US": {
        "noQuery": "Please provide a video name or reply to a video or audio attachment.",
        "noVideoFound": "No video found for the given query.",
        "downloadFailed": "Failed to retrieve download link for the video.",
        "downloadError": "Error downloading the video.",
        "generalError": "An error occurred while processing your request."
    },
    "vi_VN": {
        "noQuery": "Vui lòng cung cấp tên video hoặc trả lời một tệp đính kèm video hoặc âm thanh.",
        "noVideoFound": "Không tìm thấy video cho truy vấn đã cho.",
        "downloadFailed": "Không thể lấy liên kết tải xuống cho video.",
        "downloadError": "Lỗi khi tải xuống video.",
        "generalError": "Đã xảy ra lỗi khi xử lý yêu cầu của bạn."
    }
};

async function onCall({ message, args, getLang }) {
    try {
        let title = '';
        let shortUrl = '';
        let videoId = '';

        const extractShortUrl = async (attachment) => {
            if (attachment.type === "video" || attachment.type === "audio") {
                return attachment.url;
            } else {
                throw new Error("Invalid attachment type.");
            }
        };

        if (message.type === "message_reply" && message.messageReply.attachments?.length > 0) {
            shortUrl = await extractShortUrl(message.messageReply.attachments[0]);
            const musicRecognitionResponse = await axios.get(`https://audio-recon-ahcw.onrender.com/kshitiz?url=${encodeURIComponent(shortUrl)}`);
            title = musicRecognitionResponse.data.title;
        } else if (args.length === 0) {
            return message.reply(getLang("noQuery"));
        } else {
            title = args.join(" ");
        }

        const searchResponse = await axios.get(`https://youtube-kshitiz.vercel.app/youtube?search=${encodeURIComponent(title)}`);
        if (searchResponse.data.length > 0) {
            videoId = searchResponse.data[0].videoId;
        } else {
            return message.reply(getLang("noVideoFound"));
        }

        const downloadResponse = await axios.get(`https://youtube-kshitiz.vercel.app/download?id=${encodeURIComponent(videoId)}`);
        const videoUrl = downloadResponse.data[0];

        if (!videoUrl) {
            return message.reply(getLang("downloadFailed"));
        }

        const tempFilePath = path.join(process.cwd(), 'temp', `${videoId}.mp3`);
        const writer = fs.createWriteStream(tempFilePath);
        const response = await axios({
            url: videoUrl,
            method: 'GET',
            responseType: 'stream'
        });

        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', async () => {
                const stream = fs.createReadStream(tempFilePath);
                await message.reply({ attachment: stream });
                fs.unlinkSync(tempFilePath);
                resolve();
            });

            writer.on('error', (error) => {
                console.error("Error:", error);
                message.reply(getLang("downloadError"));
                reject(error);
            });
        });

    } catch (error) {
        console.error("Error:", error);
        return message.reply(getLang("generalError"));
    }
}

export default {
    config,
    langData,
    onCall
};
