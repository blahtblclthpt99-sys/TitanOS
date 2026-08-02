# Google Play production access answers

App: TitanOS (`com.titanos.myapp`)

Use these answers as a factual starting point. Edit any recruitment detail that is not personally accurate before submitting.

## 1. How did you recruit users for your closed test?

We recruited 16 testers through a Google Group and a paid testing community. Testers joined the closed test through Google Play and used the Play-distributed Android build. We asked them to evaluate the app on different Android devices and focus on navigation, job workflows, readability, account access, Titan AI, and general mobile usability.

## 2. How easy was it to recruit testers?

Moderately difficult. Organizing enough testers, confirming that they used the invited Google account, and keeping at least 12 people continuously opted in required active coordination.

## 3. Describe the engagement you received from testers.

Testers installed and exercised the app during the closed-test period and provided a structured usability report. Their feedback covered Play Store presentation, theme options, legal-document visibility, overlapping mobile controls, AI response quality, Android back navigation, and copy consistency. The feedback was specific enough to reproduce issues and prioritize changes.

## 4. Summarize the feedback and how it was collected.

Feedback was collected through the testing community's written report and direct closed-test communication. Testers reported that the app was stable across the devices they used and did not identify a recurring critical crash. Their improvement requests included clearer Play Store screenshots, visible light/dark theme controls, accessible Privacy Policy and Terms links, removal of overlap between feedback and Titan AI controls, more relevant AI responses, standard Android back behavior, and more consistent text formatting.

## 5. Who is the intended audience?

TitanOS is intended for independent workers, contractors, drivers, and small service-business teams. Examples include cleaning, HVAC, plumbing, landscaping, delivery, repair, and other field-service operators who need to manage customers, jobs, estimates, invoices, expenses, schedules, communications, and operational records from a mobile device.

## 6. How does the app provide value?

TitanOS brings common field-business workflows into one mobile operating system. Users can organize customers and jobs, prepare estimates and invoices, track expenses and trips, communicate with their team, review business activity, and use Titan AI for contextual assistance. This reduces switching between separate tools and helps users keep operational and financial records together.

## 7. How many installs do you expect in the first year?

Select the smallest Play Console range that matches the current launch plan. For a new independent product beginning with a controlled rollout, **1,000-10,000** is more credible than 10,000-100,000 unless there is an existing audience or funded acquisition plan that supports the larger estimate.

## 8. What changes did you make based on the closed test?

We consolidated the mobile quick actions so the feedback control and Titan AI no longer compete for the same screen space. We added responsive spacing and larger touch targets, verified light, dark, and system theme controls, and made the Privacy Policy and Terms of Service accessible from registration, settings, and public pages. We connected the production Titan AI service and confirmed that unauthenticated requests are rejected. We also strengthened loading, empty, offline, navigation, accessibility, and mobile-browser regression tests. Store-listing screenshots and additional native-device navigation validation remain part of the controlled release checklist.

## 9. How did you decide the app was ready for production?

We used both tester feedback and repeatable release gates. The production web/API deployment is healthy, the Android package and signing identity remain stable, and linting, type checking, security, payment-guard, integration, production build, desktop browser, and mobile-viewport tests pass. We also verified the live Supabase connection, access controls, and Titan AI authentication boundary. We are using a controlled rollout while completing physical-device and real payment-settlement validation rather than treating the first production release as an unrestricted launch.

## 10. What did you do differently this time?

We converted tester comments into a traceable release checklist instead of relying only on whether the app launched. We reviewed mobile layout collisions, legal links, themes, AI configuration, authentication boundaries, accessibility, and deployment health; added regression checks; and documented which items were fixed versus which still require device or operational confirmation. We also preserved the signed AAB fingerprint so the tested artifact can be verified before submission.

## Submission evidence to retain

- Closed-track name and release/version code
- Screenshot showing at least 12 continuously opted-in testers and the completed duration
- Tester report and dates
- Summary of fixes and deployment ID
- Signed AAB SHA-256 fingerprint
- Device/test notes and screenshots

