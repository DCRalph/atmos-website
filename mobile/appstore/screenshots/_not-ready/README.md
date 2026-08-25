# Not in the upload set

All real captures. Each is here for a reason.

| File | Why it is held back |
| --- | --- |
| `03-gig-next-no-tickets.png` | Same Daffodil poster as `01-home.png`, so the set reads as two pictures of one gig. It also says "Tickets aren't on sale for this one", which undercuts the pitch. `04` and `05` show the same screen doing its job. |
| `06-sign-in.png` | Half the screen is empty black, and it advertises the Guideline 4.8 problem: Google is the only social provider and there is no Sign in with Apple. |
| `04-tickets-signed-out.png` | Near-black screen with a Sign In button. This is the most important screenshot for a ticketing app, and it needs a signed-in account holding a real ticket so the QR code and Add to Apple Wallet render. |
| `05-more-signed-out.png` | Correct behaviour — note that **Internal** is absent, which is the staff gating working — but a settings list is weak marketing. |

To produce a usable Tickets screenshot: sign the simulator into the review
account, give it a comp ticket, then `ATMOS_SHOTS=07 ./scripts/screenshots.sh`.
