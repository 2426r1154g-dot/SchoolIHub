# SchoolHub 本格版セットアップ

1. Firebase Consoleで新しいプロジェクトを作成
2. Authentication → Sign-in method → Email/Password を有効化
3. Firestore Database を作成
4. プロジェクト設定 → ウェブアプリを追加
5. 表示された firebaseConfig を app.js の YOUR_... 部分に貼り付ける
6. Firestore Rules に firestore.rules の内容を貼り付ける
7. index.html を Firebase Hosting / GitHub Pages / Cloudflare Pages などへ公開

重要:
- この構成ではログインしたユーザーだけがデータを読める
- 投稿・イベント・勉強記録はFirestoreでリアルタイム更新
- 本番運用では通報、ブロック、NGワード、管理者権限、個人情報保護方針なども追加推奨
- FirebaseのAPIキーはWebアプリでは完全な秘密情報ではないが、Firestore Rules等でアクセス制御を必ず行う

追加機能:
- 勉強タイマーで時間を計測
- 計測した分数を勉強記録へ追加可能
