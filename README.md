# Kit Lifecycle Dashboard

- **Live:** https://tarunsahnan.github.io/kit-lifecycle-dashboard/
- **Code:** https://github.com/tarunsahnan/kit-lifecycle-dashboard

## Decisions and assumptions

- Mixed timestamps formats: Most event times end in Z, which means UTC. Some carry an offset like -05:00, and some have no time zone at all. To compare times, they all need to be on one timezone, so everything becomes UTC. For the ones with no zone, I assume UTC because most of the file is UTC and the generator writes those values in UTC too.

- Order dates in local time zones: Converted these to UTC also.

- Test orders: They’re hidden by default, and one checkbox shows them again if ops wants to check them. They aren’t real customers, so they’d skew volumes and turnaround times.

- upload_only orders: Here the customer uploads DNA data they already have, so no kit is shipped. They count toward total orders volume, but not toward the kit pipeline. If they were included, they’d look like 740 kits that never shipped and would all be flagged as stuck.

- Cancelled orders are never flagged as stuck. “Stuck” means “someone needs to follow up so this kit keeps moving”. A cancelled order is never supposed to move forward.

- Refunded orders are never flagged as stuck. It’s the same reasoning. A refunded order deliberately stops partway: the customer got their money back, so the pipeline stops.

- Replaced kits:
  - Only the newest kit on an order counts as in progress. The old kit ended at kit_replaced, so it shouldn’t be flagged as stuck.
  - The new kit’s “time to ship” is measured from kit_replaced, not from when the order was placed. Otherwise it would include weeks the old kit already spent, and order-to-shipped times would look terrible.

- Paid orders that never shipped are flagged as stuck. Three paid orders, placed Oct 4–11, have no events at all. The target for order to shipped is 3 days, and by the export date they were 9–16 days old, so they’re clearly late.

- Duplicate events: The same event can appear multiple times with different event_id values. I identify duplicates using the kit ID, event type, and normalized UTC timestamp rather than the raw timestamp string.

- Orphan events: These are events whose order_id doesn't exist in orders.csv. I exclude them because there's no corresponding order to associate them with.

- As-of date: I use the latest event timestamp in the dataset as the reference date for calculating how long kits have been waiting. The dataset was exported on October 20, while the latest event is from October 19 at 23:46 UTC. Using today's date (November 4) would incorrectly add around 16 days to every open kit.

- Missed scans: Sometimes a pipeline event is missing, but a later event confirms that the step must have happened. For example, if sample_received exists but sample_mailed doesn't, I infer that the sample was mailed but the scan was missed. I don't flag the kit as stuck at that missing step.

- Definition of stuck: A kit is considered stuck only if the order is paid and not a test (unless the include internal test orders checkbox is active in the filter), cancelled, refunded, or upload-only; it's the newest kit on the order; it hasn't reached report_ready; and it has exceeded the target time for its current stage.

- No backend: The dataset is relatively small (approximately 2 MB, 5,000 orders, and 24,000 events), and the browser parses and cleans it in around 35 ms. A backend wouldn't provide meaningful performance benefits at this scale. Since the brief calls for a no-login, no-setup experience, keeping the app static and client-side makes sense.



## What I'd do next

- Implement a backend and database to support persistent data storage, along with shareable links for uploaded datasets.
- Add a toggle to switch between local time and UTC when displaying dates.


## How I used AI

- Asked AI to analyze the assignment and create an implementation plan.
- Reviewed and understood the entire plan before asking AI to implement and test it.
- Provided my own suggestions and feedback to refine the web app's UI/UX and improve the overall user experience.

### Where it got something wrong

- AI initially displayed all filters horizontally in a single row, which resulted in a messy and less intuitive UX. I moved them into a dropdown to provide a cleaner UX.
- AI initially placed the filters section below the tabs. However, since the filters apply across all tabs, positioning them below the tabs could give users the impression that they only apply to the currently selected tab. To avoid this confusion, I moved the filters section above the tabs, making it clear that the filters are global and apply across all tabs. Also, I added a note about this.


