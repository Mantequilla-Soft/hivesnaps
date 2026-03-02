# HiveSnaps 📸

HiveSnaps is a cutting-edge React Native mobile app built with Expo and TypeScript that brings the power of the Hive blockchain to short-form social media content. Think Twitter meets Instagram, but decentralized and powered by Web3.

![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)
![Expo](https://img.shields.io/badge/Expo-~53.0.12-black.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-~5.8.3-blue.svg)
![Hive](https://img.shields.io/badge/Blockchain-Hive-red.svg)

## ✨ Features

### 🔐 Blockchain Integration

- **Hive Blockchain Authentication** - Secure login with Hive posting keys
- **Decentralized Content** - All posts stored on-chain via @peak.snaps
- **Voting & Rewards** - Upvote posts with customizable weight (1-100%)
- **Real-time Reward Calculation** - See vote values in USD before voting
- **Voting Power Display** - Track your voting power with helpful tooltips

### 📱 Social Features

- **Multiple Feed Views** - Following, Newest, Trending, and My Snaps
- **Rich Text Support** - Markdown rendering with hashtag detection
- **User Profiles** - View any user's profile with post history
- **Threaded Conversations** - Full reply system with nested discussions
- **Mentions & Hashtags** - @username mentions and #hashtag discovery
- **Smart Caching** - 5-minute intelligent feed caching for performance

### 🎨 Rich Media Support

- **Image Uploads** - Camera capture or gallery selection with Cloudinary hosting
- **GIF Integration** - Powered by Tenor API with search functionality
- **Video Embedding** - YouTube, 3Speak, and IPFS video support
- **Instagram Embeds** - Native Instagram post rendering in feed
- **Twitter/X Embeds** - Native tweet rendering in posts
- **Image Galleries** - Full-screen image viewing with zoom

### 📝 Content Creation

- **Smart Composer** - Rich text editor with live previews
- **Media Attachments** - Images, GIFs, and video embeds
- **Edit Functionality** - Edit your posts and replies after publishing
- **Three-Dots Menu** - Quick actions including "Go to Profile" and content reporting
- **Optimistic Updates** - Instant UI updates for better UX
- **Draft Support** - Auto-save functionality (coming soon)

### 🔔 User Experience

- **Notifications System** - Track mentions, votes, and replies
- **Content Moderation** - Community-driven reporting and moderation system
- **Terms of Service** - Required acceptance for App Store compliance
- **Dark/Light Theme** - Automatic theme switching
- **Pull-to-Refresh** - Intuitive feed updates
- **Infinite Scroll** - Smooth content loading
- **Offline Support** - Cached content available offline
- **Haptic Feedback** - Native mobile interactions

### 🎯 Discovery Features

- **Hashtag Explorer** - Discover content by topics
- **User Search** - Find and follow interesting accounts
- **Trending Algorithm** - Content ranked by blockchain rewards
- **External Link Handling** - Smart preview and opening

## 🛠 Technical Stack

### Frontend

- **React Native** (0.79.4) with Expo (53.0.12)
- **TypeScript** for type safety
- **Expo Router** for navigation
- **React Native Reanimated** for smooth animations
- **Expo AV** for video playback

### Blockchain

- **@hiveio/dhive** for Hive blockchain integration
- **Expo Secure Store** for private key management
- **Real-time API** connections to multiple Hive nodes

### Media & Storage

- **Cloudinary** as fallback for image hosting and optimization
- **Tenor API** for GIF search and integration
- **Expo Image Picker** for camera/gallery access
- **AsyncStorage** for local data persistence

### UI/UX

- **Safe Area Context** for notch/status bar handling
- **React Native Webview** for embedded content
- **React Native Markdown** for rich text rendering
- **Custom Icon System** with FontAwesome

## 📲 Download

**HiveSnaps is now available on the App Store!**

[![Download on the App Store](https://img.shields.io/badge/App%20Store-Download-blue?logo=app-store&logoColor=white)](https://apps.apple.com/us/app/hive-snaps/id6748106413)

- **iOS**: [Download from App Store](https://apps.apple.com/us/app/hive-snaps/id6748106413)
- **Android**: [Download from PlayStore](https://play.google.com/store/apps/details?id=com.menobass.hivesnaps)

## 🚀 Getting Started

1. **Clone the repository:**

   ```sh
   git clone https://github.com/menobass/hivesnaps.git
   cd hivesnaps
   ```

2. **Install dependencies:**

   ```sh
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env` file with your API keys:

   ```env
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   TENOR_API_KEY=your_tenor_key
   EXPO_PUBLIC_3SPEAK_API_KEY=your_3speak_api_key
   EXPO_PUBLIC_IPFS_UPLOAD_ENDPOINT=https://ipfs.3speak.tv/api/v0/add
   EXPO_PUBLIC_IPFS_GATEWAY_URL=https://ipfs.3speak.tv/ipfs
   # EXPO_PUBLIC_IPFS_API_KEY=optional_ipfs_key
   ```

4. **Start the development server:**

   ```sh
   npx expo start
   ```

5. **Run on device:**
   - Use Expo Go app for development
   - Or build development client: `npx expo run:android` / `npx expo run:ios`

## 📱 Platform Support

- **iOS** - Full feature support with native integrations
- **Android** - Complete Android experience with edge-to-edge UI
- **Web** - Progressive Web App capabilities (limited features)

## 🔧 Development

### Avatar Unification

We standardized avatars to images.hive.blog across the app. See `docs/avatar-unification.md` for details on behavior, affected files, and testing.

### Moderation & Community Guidelines

HiveSnaps implements a comprehensive content moderation system:

- **Community Reporting** - Users can report inappropriate content through three-dots menu
- **Blockchain-native Moderation** - Content moderation via @snapie account voting system  
- **Automatic Content Filtering** - Posts with moderation downvotes are hidden from interface
- **Zero-tolerance Policy** - Strict enforcement against harassment, abuse, and harmful content
- **Terms of Service** - Required acceptance with App Store compliance for community standards

See `docs/moderation.md` for detailed policy, configuration, and technical implementation.

### Testing

```sh
npm test
```

### Building for Production

```sh
# Android
npx expo build:android

# iOS
npx expo build:ios
```

### Code Structure

```
app/
├── components/        # Reusable UI components
├── utils/            # Helper functions and utilities
├── hooks/            # Custom React hooks
├── assets/           # Images, fonts, and static files
└── screens/          # Main application screens
```

## 🎯 Roadmap

### v1.2.0 (Next Release)

- [ ] Push notifications for mentions and votes
- [ ] Advanced search functionality
- [ ] Video uploads
- [ ] Multiple account support

## 🤝 Contributing

We welcome contributions! Please read our contributing guidelines and submit pull requests for any improvements.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Hive Blockchain** - For providing the decentralized infrastructure
- **Peak.d** - For the @peak.snaps container system
- **Expo Team** - For the amazing development platform
- **React Native Community** - For the open-source ecosystem

---

**HiveSnaps** - _What's snappening today?_ 🚀

Follow us: [@snapie](https://hive.blog/@snapie) | Join our community on [Discord](https://discord.gg/CgJP7t7nWy) (permanent invite)
