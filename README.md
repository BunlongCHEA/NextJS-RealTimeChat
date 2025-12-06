This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Installation library

```bash
npm install tailwind-merge
```
Designed to intelligently merge Tailwind CSS classes, so that eliminates this ambiguity by ensuring the "last class wins" principle.

Ex: if you have p-5 and px-2, tailwind-merge will prioritize the more specific px-2 for horizontal padding while keeping the vertical padding from p-5.

```bash
npm install --save clsx
```
A small JavaScript utility that simplifies the process of creating className strings in React (and by extension, Next.js) applications, especially when dealing with conditional styling.

Ex:
className=
{clsx(
    'base-style', // Always applied
    isActive && 'active-style', // Applied only if isActive is true
    hasError && 'error-style', // Applied only if hasError is true
    { 'disabled-style': !isActive } // Applied if isActive is false
)}

```bash
npm install @heroicons/react
```
Heroicons are a set of free, open-source SVG icons created by the makers of Tailwind CSS. They are widely used in web development, especially with React and Next.js projects, due to their clean design, ease of use, and compatibility with Tailwind CSS

```bash
npm install @stomp/stompjs sockjs-client
```
@stomp/stompjs is the STOMP client library, and sockjs-client is often used as a fallback for WebSocket connections in older browsers or environments that might not natively support WebSockets.

```bash
npm install firebase
```
Firebase provides a variety of integrated services for app development. Key features include Authentication, Databases, Cloud Storage, Cloud Message (FCM as we used in this SpringBoot Project), Hosting, Crashlytics, Performance Monitoring, etc.

```bash
npm install -g firebase-tools
```
firebase-tools is necessary to access the Firebase Command Line Interface (CLI) from any directory on your computer. The CLI is a powerful tool used to manage, test, and deploy your Firebase projects from your local machine.

```bash
npm install @vercel/analytics
```
@vercel/analytics allows Vercel Web Analytics to automatically track page views and provide insights into your website's performance and traffic within your Vercel Dashboard. Note that analytics data is not tracked in development mode.


## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
