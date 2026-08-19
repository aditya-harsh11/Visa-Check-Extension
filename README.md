# Visa Check

A browser extension that checks job postings for you and tells you if you can apply as an international student who needs visa sponsorship.

## What it does

When you open a job posting, a small box shows up in the corner of the page with one of three answers:

- ✅ **Can Apply** — the posting doesn't mention any citizenship or visa restrictions.
- 🚫 **Does Not Sponsor** — the posting clearly says it won't sponsor a visa, or requires U.S. citizenship / a green card.
- ⚠️ **Mixed Signals** — the posting mentions visa or sponsorship words, but it's not totally clear one way or the other. Read the job description yourself to be sure.

Click the box to expand it and see exactly which words or sentences it found, so you can check them yourself.

## How to use it

1. Open `chrome://extensions` in your browser.
2. Turn on **Developer mode** (top right corner).
3. Click **Load unpacked** and select this folder.
4. Visit any job posting page. The box will appear automatically.
5. Click **Re-scan page** if the page changes and you want it to check again.

## A few honest limits

- It's just reading the text on the page and looking for certain words and phrases — it's not perfect.
- "Can Apply" means it didn't find anything concerning, not a guarantee the company will actually sponsor you. Always double check.
- It only works on pages it thinks are job postings.
