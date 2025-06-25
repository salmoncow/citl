# Pre-Season

## Communications

# Season

## Communications

## Scoring

### Day 0

### Day 1+
* Retrieve trap scores from Darnall's. Ron keeps them in a paper organizer behind the counter near his desk.
* Enter the scores into the _Scorecards_ Excel tab, team by team.
   * Use Darnall's scorecards as the source of truth. The one where shooters add up their own scores are sometimes wrong. I mostly use them as a checksum to validate any errors.
   * Make a note of anyone who got a 25 or 50 straight. We acknowledge these accolades.
* Update _Standings & Awards_ tab as follows:
   * Update cell `A4` by selecting the current week
   * Sort cell `A5` by _Smallest to Largest_
* Navigate to the `HTML` tab.
   * I intentionally kept this simple for anyone who wanted to take this on. It's all copy/paste of HTML.
   * Copy/paste cell ranges `A4:K4 | A22:K22` into HTML page. Delete any empty score rows.
   * Copy/paste cell ranges `M3:AQ3 | M236:AQ236` into HTML page. The range varies depending on how many teams shoot each year.
* Navigate to _Weekly Score Sheets_ tab.
   * Update cell `A1` (Header) with the upcoming week count
   * Update cell `A1` (Header) with the upcoming week date
   * Export to PDF. File -> Export -> Create PDF/XPS
      * This goes in the `~\citl-static\src\spa\assets\score_sheets` directory. Be sure to update the download URL so Ron can download and print the score sheets for the upcoming week.

## Exceptions

### Substitute Shooter

### New Shooter Added


# Post Season

# Innovation Ideas

## Updated website
* Allow user functionality and registration capabilities
* Allow users to create and manage teams on the website
* Allow users to take photos of their scorecards and submit them via their phones. Use something like AWS Textract to read in the scores
* Create all the database backend needed to store scores submitted by you or users
* Dynamically generate website content instead of just having static HTML pages
