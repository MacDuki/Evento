declare module "web-push" {
  interface WebPush {
    setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  }
  const webpush: WebPush;
  export default webpush;
}
