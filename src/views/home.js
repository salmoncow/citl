/**
 * homeView — 2025 Season results and standings
 *
 * Migrated from src/spa/index.html (main content only).
 * Static per-week standings tables remain for historical weeks 1–14.
 * The final standings section uses <standings-table> (Phase 4 Web Component).
 */

/**
 * Returns the HTML string for the home/standings view.
 * @returns {string}
 */
export function homeView() {
  return `
    <h1>Week 15 Results</h1>
    <h5>Updated: 7/26/2025</h5>

    <p>
      Hello, everyone! The 2025 season has officially come to a close. I appreciate everyone
      participating this year and look forward to kicking off the season again in early 2026.
    </p>

    <p>
      Trophies will again be
      <a href="https://shootingsportsouvenirs.com/index.php?id=walnut-birds" target="_blank">
        Walnut Birds with Stands from Shooting Sports Souvenirs
      </a>.
      The total price per trophy with stand is $28.00. These are high quality walnut birds!
      <b>Captains of teams in the trophy list below, please coordinate with me on who from your
      team is interested in purchasing and I will put in a bulk order.</b>
    </p>

    <p>Here is an example of what will be engraved on the trophy (year and names updated to
    reflect this season, of course):</p>

    <p style="text-align: center;">
      <img style="height: 300px;" src="/assets/images/trophy_custom_1.png" alt="Example trophy">
    </p>

    <h2>Trophies</h2>
    <table class="bonus-tables">
      <tr><td><img style="height:35px;" src="/assets/images/trophy_1.png" alt="1st place">1st Place Team</td><td>Sights Impaired</td><td>433</td></tr>
      <tr><td><img style="height:35px;" src="/assets/images/trophy_2.png" alt="2nd place">2nd Place Team</td><td>Full Choke Artists</td><td>415</td></tr>
      <tr><td>Highest Average</td><td>Randy Jones</td><td>44.4</td></tr>
      <tr><td>Rookie of the Year</td><td>Micheal Benjamin</td><td>43.3</td></tr>
      <tr><td>Most Improved</td><td>Alex Wickline</td><td>51.79%</td></tr>
    </table>

    <h2>Highest Shooter Average by Team</h2>
    <p style="text-align: center;"><i>Must have shot at least 6 times during the season</i></p>
    <table class="bonus-tables" style="width: 50%">
      <tr><th>Team</th><th>Shooter</th><th>Average</th></tr>
      <tr><td>Bullshooters</td><td>Lindsay Bourda</td><td>42.6</td></tr>
      <tr><td>Full Choke Artists</td><td>Randy Jones</td><td>44.4</td></tr>
      <tr><td>Missed Again</td><td>Dave Coale</td><td>42.1</td></tr>
      <tr><td>Powder Burners</td><td>Laurin Bartelmay</td><td>41.3</td></tr>
      <tr><td>Shell Shocked</td><td>Marc Herren</td><td>41.6</td></tr>
      <tr><td>Shockers</td><td>Matt Lamb</td><td>43.5</td></tr>
      <tr><td>Sights Impaired</td><td>Allen Cary</td><td>42</td></tr>
      <tr><td>Smoking Guns</td><td>Jonathan Roberson</td><td>44.1</td></tr>
    </table>

    <h2>Accolades</h2>
    <ul>
      <li><b>Lindsay Bourda</b> from <i>Bullshooters</i> with a 25 straight!</li>
    </ul>

    <h2>Final Standings</h2>
    <standings-table year="2025"></standings-table>

    <h4><hr></h4>

    <h1>Week 14 Results</h1>
    <h5>Updated: 7/17/2025</h5>

    <h2>Accolades</h2>
    <ul>
      <li><b>Brandon Compton</b> from <i>Powder Burners</i> with a 25 straight!</li>
    </ul>

    <h2>Standings (Week 14)</h2>
    <table class="standing-table">
      <tr><th>Standing</th><th>Team</th><th>Captain</th><th>Targets</th><th>Total Targets</th><th>Rank Points</th><th>Bonus Points</th><th>Total Points</th></tr>
      <tr><td>1</td><td>Sights Impaired</td><td>Dan Barrington</td><td>179</td><td>2683</td><td>20</td><td>0</td><td>403</td></tr>
      <tr><td>2</td><td>Missed Again</td><td>Loren Lamar</td><td>196</td><td>2719</td><td>28</td><td>0</td><td>385</td></tr>
      <tr><td>3</td><td>Full Choke Artists</td><td>Randy Jones</td><td>192</td><td>2714</td><td>24</td><td>5</td><td>382</td></tr>
      <tr><td>4</td><td>Shockers</td><td>Logan McKenna</td><td>180</td><td>2631</td><td>22</td><td>0</td><td>375</td></tr>
      <tr><td>5</td><td>Bullshooters</td><td>Greg Litchfield</td><td>193</td><td>2625</td><td>26</td><td>5</td><td>364</td></tr>
      <tr><td>6</td><td>Smoking Guns</td><td>Gordon Larsen</td><td>165</td><td>2615</td><td>16</td><td>0</td><td>361</td></tr>
      <tr><td>7</td><td>Powder Burners</td><td>Sarah Paul</td><td>170</td><td>2587</td><td>18</td><td>0</td><td>359</td></tr>
      <tr><td>8</td><td>Shell Shocked</td><td>Troy Johns</td><td>198</td><td>2377</td><td>30</td><td>5</td><td>327</td></tr>
    </table>

    <h4><hr></h4>

    <h1>Week 13 Results</h1>
    <h5>Updated: 7/13/2025</h5>

    <h2>Accolades</h2>
    <ul>
      <li><b>Ron Milby</b> from <i>Sights Impaired</i> with a 25 straight!</li>
      <li><b>Branden Sholty</b> from <i>Full Choke Artists</i> with a 25 straight!</li>
    </ul>

    <h2>Standings (Week 13)</h2>
    <table class="standing-table">
      <tr><th>Standing</th><th>Team</th><th>Captain</th><th>Targets</th><th>Total Targets</th><th>Rank Points</th><th>Bonus Points</th><th>Total Points</th></tr>
      <tr><td>1</td><td>Sights Impaired</td><td>Dan Barrington</td><td>196</td><td>2504</td><td>24</td><td>5</td><td>383</td></tr>
      <tr><td>2</td><td>Missed Again</td><td>Loren Lamar</td><td>192</td><td>2523</td><td>19</td><td>0</td><td>357</td></tr>
      <tr><td>3</td><td>Full Choke Artists</td><td>Randy Jones</td><td>195</td><td>2522</td><td>22</td><td>5</td><td>353</td></tr>
      <tr><td>4</td><td>Shockers</td><td>Logan McKenna</td><td>208</td><td>2451</td><td>28</td><td>5</td><td>353</td></tr>
      <tr><td>5</td><td>Smoking Guns</td><td>Gordon Larsen</td><td>192</td><td>2450</td><td>19</td><td>5</td><td>345</td></tr>
      <tr><td>6</td><td>Powder Burners</td><td>Sarah Paul</td><td>218</td><td>2417</td><td>30</td><td>5</td><td>341</td></tr>
      <tr><td>7</td><td>Bullshooters</td><td>Greg Litchfield</td><td>184</td><td>2432</td><td>16</td><td>0</td><td>333</td></tr>
      <tr><td>8</td><td>Shell Shocked</td><td>Troy Johns</td><td>203</td><td>2179</td><td>26</td><td>5</td><td>292</td></tr>
    </table>

    <h4><hr></h4>

    <h1>Week 12 Results</h1>
    <h5>Updated: 6/25/2025</h5>

    <h2>Accolades</h2>
    <ul>
      <li><b>Alex Wickline</b> from <i>Smoking Guns</i> with a 25 straight!</li>
      <li><b>Randy Jones</b> from <i>Full Choke Artists</i> with a 25 straight!</li>
    </ul>

    <h2>Standings (Week 12)</h2>
    <table class="standing-table">
      <tr><th>Standing</th><th>Team</th><th>Captain</th><th>Targets</th><th>Total Targets</th><th>Rank Points</th><th>Bonus Points</th><th>Total Points</th></tr>
      <tr><td>1</td><td>Sights Impaired</td><td>Dan Barrington</td><td>197</td><td>2308</td><td>26</td><td>5</td><td>354</td></tr>
      <tr><td>2</td><td>Missed Again</td><td>Loren Lamar</td><td>198</td><td>2331</td><td>28</td><td>0</td><td>338</td></tr>
      <tr><td>3</td><td>Full Choke Artists</td><td>Randy Jones</td><td>191</td><td>2327</td><td>20</td><td>5</td><td>326</td></tr>
      <tr><td>4</td><td>Smoking Guns</td><td>Gordon Larsen</td><td>195</td><td>2258</td><td>23</td><td>5</td><td>321</td></tr>
      <tr><td>5</td><td>Shockers</td><td>Logan McKenna</td><td>181</td><td>2243</td><td>16</td><td>0</td><td>320</td></tr>
      <tr><td>6</td><td>Bullshooters</td><td>Greg Litchfield</td><td>195</td><td>2248</td><td>23</td><td>5</td><td>317</td></tr>
      <tr><td>7</td><td>Powder Burners</td><td>Sarah Paul</td><td>189</td><td>2199</td><td>18</td><td>0</td><td>306</td></tr>
      <tr><td>8</td><td>Shell Shocked</td><td>Troy Johns</td><td>202</td><td>1976</td><td>30</td><td>5</td><td>261</td></tr>
    </table>

    <h4><hr></h4>

    <h1>Week 11 Results</h1>
    <h5>Updated: 6/21/2025</h5>

    <h2>Standings (Week 11)</h2>
    <table class="standing-table">
      <tr><th>Standing</th><th>Team</th><th>Captain</th><th>Targets</th><th>Total Targets</th><th>Rank Points</th><th>Bonus Points</th><th>Total Points</th></tr>
      <tr><td>1</td><td>Sights Impaired</td><td>Dan Barrington</td><td>202</td><td>2111</td><td>26</td><td>5</td><td>323</td></tr>
      <tr><td>2</td><td>Missed Again</td><td>Loren Lamar</td><td>200</td><td>2133</td><td>22</td><td>5</td><td>310</td></tr>
      <tr><td>3</td><td>Shockers</td><td>Logan McKenna</td><td>204</td><td>2062</td><td>28</td><td>5</td><td>304</td></tr>
      <tr><td>4</td><td>Full Choke Artists</td><td>Randy Jones</td><td>199</td><td>2136</td><td>20</td><td>0</td><td>301</td></tr>
      <tr><td>5</td><td>Smoking Guns</td><td>Gordon Larsen</td><td>201</td><td>2063</td><td>24</td><td>5</td><td>293</td></tr>
      <tr><td>6</td><td>Bullshooters</td><td>Greg Litchfield</td><td>208</td><td>2053</td><td>30</td><td>5</td><td>289</td></tr>
      <tr><td>7</td><td>Powder Burners</td><td>Sarah Paul</td><td>184</td><td>2010</td><td>18</td><td>0</td><td>288</td></tr>
      <tr><td>8</td><td>Shell Shocked</td><td>Troy Johns</td><td>169</td><td>1774</td><td>16</td><td>0</td><td>226</td></tr>
    </table>

    <h4><hr></h4>

    <h1>Week 10 Results</h1>
    <h5>Updated: 6/14/2025</h5>

    <h2>Standings (Week 10)</h2>
    <table class="standing-table">
      <tr><th>Standing</th><th>Team</th><th>Captain</th><th>Targets</th><th>Total Targets</th><th>Rank Points</th><th>Bonus Points</th><th>Total Points</th></tr>
      <tr><td>1</td><td>Sights Impaired</td><td>Dan Barrington</td><td>205</td><td>1909</td><td>30</td><td>6</td><td>292</td></tr>
      <tr><td>2</td><td>Missed Again</td><td>Loren Lamar</td><td>177</td><td>1933</td><td>18</td><td>0</td><td>283</td></tr>
      <tr><td>3</td><td>Full Choke Artists</td><td>Randy Jones</td><td>179</td><td>1937</td><td>20</td><td>0</td><td>281</td></tr>
      <tr><td>4</td><td>Shockers</td><td>Logan McKenna</td><td>190</td><td>1858</td><td>27</td><td>6</td><td>271</td></tr>
      <tr><td>5</td><td>Powder Burners</td><td>Sarah Paul</td><td>186</td><td>1826</td><td>24</td><td>6</td><td>270</td></tr>
      <tr><td>6</td><td>Smoking Guns</td><td>Gordon Larsen</td><td>185</td><td>1862</td><td>22</td><td>2</td><td>264</td></tr>
      <tr><td>7</td><td>Bullshooters</td><td>Greg Litchfield</td><td>190</td><td>1845</td><td>27</td><td>5</td><td>254</td></tr>
      <tr><td>8</td><td>Shell Shocked</td><td>Troy Johns</td><td>163</td><td>1605</td><td>16</td><td>0</td><td>210</td></tr>
    </table>

    <h4><hr></h4>

    <h1>Week 9 Results</h1>
    <h5>Updated: 6/8/2025</h5>

    <h2>Standings (Week 9)</h2>
    <table class="standing-table">
      <tr><th>Standing</th><th>Team</th><th>Captain</th><th>Targets</th><th>Total Targets</th><th>Rank Points</th><th>Bonus Points</th><th>Total Points</th></tr>
      <tr><td>1</td><td>Missed Again</td><td>Loren Lamar</td><td>193</td><td>1756</td><td>22</td><td>0</td><td>265</td></tr>
      <tr><td>2</td><td>Full Choke Artists</td><td>Randy Jones</td><td>203</td><td>1758</td><td>26</td><td>0</td><td>261</td></tr>
      <tr><td>3</td><td>Sights Impaired</td><td>Dan Barrington</td><td>198</td><td>1704</td><td>24</td><td>6</td><td>256</td></tr>
      <tr><td>4</td><td>Smoking Guns</td><td>Gordon Larsen</td><td>207</td><td>1677</td><td>28</td><td>5</td><td>240</td></tr>
      <tr><td>5</td><td>Powder Burners</td><td>Sarah Paul</td><td>192</td><td>1640</td><td>20</td><td>0</td><td>240</td></tr>
      <tr><td>6</td><td>Shockers</td><td>Logan McKenna</td><td>187</td><td>1668</td><td>18</td><td>7</td><td>238</td></tr>
      <tr><td>7</td><td>Bullshooters</td><td>Greg Litchfield</td><td>211</td><td>1655</td><td>30</td><td>6</td><td>222</td></tr>
      <tr><td>8</td><td>Shell Shocked</td><td>Troy Johns</td><td>176</td><td>1442</td><td>16</td><td>0</td><td>194</td></tr>
    </table>

    <h4><hr></h4>

    <h1>Week 8 Results</h1>
    <h5>Updated: 5/31/2025</h5>

    <h2>Standings (Week 8)</h2>
    <table class="standing-table">
      <tr><th>Standing</th><th>Team</th><th>Captain</th><th>Targets</th><th>Total Targets</th><th>Rank Points</th><th>Bonus Points</th><th>Total Points</th></tr>
      <tr><td>1</td><td>Missed Again</td><td>Loren Lamar</td><td>198</td><td>1563</td><td>24</td><td>5</td><td>243</td></tr>
      <tr><td>2</td><td>Full Choke Artists</td><td>Randy Jones</td><td>207</td><td>1555</td><td>30</td><td>5</td><td>235</td></tr>
      <tr><td>3</td><td>Sights Impaired</td><td>Dan Barrington</td><td>199</td><td>1506</td><td>26</td><td>5</td><td>226</td></tr>
      <tr><td>4</td><td>Powder Burners</td><td>Sarah Paul</td><td>204</td><td>1448</td><td>28</td><td>5</td><td>220</td></tr>
      <tr><td>5</td><td>Shockers</td><td>Logan McKenna</td><td>194</td><td>1481</td><td>22</td><td>6</td><td>213</td></tr>
      <tr><td>6</td><td>Smoking Guns</td><td>Gordon Larsen</td><td>191</td><td>1470</td><td>20</td><td>6</td><td>207</td></tr>
      <tr><td>7</td><td>Bullshooters</td><td>Greg Litchfield</td><td>189</td><td>1444</td><td>18</td><td>7</td><td>186</td></tr>
      <tr><td>8</td><td>Shell Shocked</td><td>Troy Johns</td><td>177</td><td>1266</td><td>16</td><td>1</td><td>178</td></tr>
    </table>

    <h4><hr></h4>

    <h1>Week 7 Results</h1>
    <h5>Updated: 5/24/2025</h5>

    <h2>Accolades</h2>
    <ul>
      <li><b>Rich Drennen</b> from <i>Sights Impaired</i> with a 25 straight!</li>
    </ul>

    <h2>Standings (Week 7)</h2>
    <table class="standing-table">
      <tr><th>Standing</th><th>Team</th><th>Captain</th><th>Targets</th><th>Total Targets</th><th>Rank Points</th><th>Bonus Points</th><th>Total Points</th></tr>
      <tr><td>1</td><td>Missed Again</td><td>Loren Lamar</td><td>207</td><td>1365</td><td>30</td><td>5</td><td>214</td></tr>
      <tr><td>2</td><td>Full Choke Artists</td><td>Randy Jones</td><td>189</td><td>1348</td><td>19</td><td>5</td><td>200</td></tr>
      <tr><td>3</td><td>Sights Impaired</td><td>Dan Barrington</td><td>199</td><td>1307</td><td>26</td><td>6</td><td>195</td></tr>
      <tr><td>4</td><td>Powder Burners</td><td>Sarah Paul</td><td>197</td><td>1244</td><td>23</td><td>5</td><td>187</td></tr>
      <tr><td>5</td><td>Shockers</td><td>Logan McKenna</td><td>202</td><td>1287</td><td>28</td><td>6</td><td>185</td></tr>
      <tr><td>6</td><td>Smoking Guns</td><td>Gordon Larsen</td><td>197</td><td>1279</td><td>23</td><td>6</td><td>181</td></tr>
      <tr><td>7</td><td>Bullshooters</td><td>Greg Litchfield</td><td>175</td><td>1255</td><td>16</td><td>1</td><td>161</td></tr>
      <tr><td>8</td><td>Shell Shocked</td><td>Troy Johns</td><td>189</td><td>1089</td><td>19</td><td>6</td><td>161</td></tr>
    </table>

    <h4><hr></h4>

    <h1>Week 6 Results</h1>
    <h5>Updated: 5/17/2025</h5>

    <h2>Accolades</h2>
    <ul>
      <li><b>Gary Garrett</b> from <i>Missed Again</i> with a <b>50</b> straight!</li>
      <li><b>Tal Parmenter</b> from <i>Shell Shocked</i> with a <b>50</b> straight!</li>
      <h4><hr class="custom-length"></h4>
      <li><b>Jeff Abel</b> from <i>Full Choke Artists</i> with a 25 straight!</li>
      <li><b>Neal Percieval</b> from <i>Full Choke Artists</i> with a 25 straight!</li>
      <li><b>Shannon McMahon</b> from <i>Sights Impaired</i> with a 25 straight!</li>
      <li><b>Matt Lamb</b> from <i>Shockers</i> with a 25 straight!</li>
    </ul>

    <h2>Standings (Week 6)</h2>
    <table class="standing-table">
      <tr><th>Standing</th><th>Team</th><th>Captain</th><th>Targets</th><th>Total Targets</th><th>Rank Points</th><th>Bonus Points</th><th>Total Points</th></tr>
      <tr><td>1</td><td>Missed Again</td><td>Loren Lamar</td><td>218</td><td>1158</td><td>28</td><td>5</td><td>179</td></tr>
      <tr><td>2</td><td>Full Choke Artists</td><td>Randy Jones</td><td>223</td><td>1159</td><td>30</td><td>5</td><td>176</td></tr>
      <tr><td>3</td><td>Sights Impaired</td><td>Dan Barrington</td><td>217</td><td>1108</td><td>26</td><td>5</td><td>163</td></tr>
      <tr><td>4</td><td>Powder Burners</td><td>Sarah Paul</td><td>189</td><td>1047</td><td>16</td><td>6</td><td>159</td></tr>
      <tr><td>5</td><td>Smoking Guns</td><td>Gordon Larsen</td><td>197</td><td>1082</td><td>23</td><td>5</td><td>152</td></tr>
      <tr><td>6</td><td>Shockers</td><td>Logan McKenna</td><td>190</td><td>1085</td><td>19</td><td>6</td><td>151</td></tr>
      <tr><td>7</td><td>Bullshooters</td><td>Greg Litchfield</td><td>190</td><td>1080</td><td>19</td><td>6</td><td>144</td></tr>
      <tr><td>8</td><td>Shell Shocked</td><td>Troy Johns</td><td>197</td><td>900</td><td>23</td><td>6</td><td>136</td></tr>
    </table>

    <h4><hr></h4>

    <h1>Week 5 Results</h1>
    <h5>Updated: 5/7/2025</h5>

    <h2>Accolades</h2>
    <ul>
      <li><b>Ron Milby</b> from <i>Sights Impaired</i> with a 25 straight!</li>
      <li><b>Rich Drennen</b> from <i>Sights Impaired</i> with a 25 straight!</li>
      <li><b>Brad Allen</b> from <i>Full Choke Artists</i> with a 25 straight!</li>
      <li><b>Troy Johns</b> from <i>Shell Shocked</i> with a 25 straight!</li>
      <li><b>Marc Herren</b> from <i>Shell Shocked</i> with a 25 straight!</li>
    </ul>

    <h2>Standings (Week 5)</h2>
    <table class="standing-table">
      <tr><th>Standing</th><th>Team</th><th>Captain</th><th>Targets</th><th>Total Targets</th><th>Rank Points</th><th>Bonus Points</th><th>Total Points</th></tr>
      <tr><td>1</td><td>Missed Again</td><td>Loren Lamar</td><td>218</td><td>940</td><td>28</td><td>5</td><td>146</td></tr>
      <tr><td>2</td><td>Full Choke Artists</td><td>Randy Jones</td><td>223</td><td>936</td><td>30</td><td>5</td><td>141</td></tr>
      <tr><td>3</td><td>Powder Burners</td><td>Sarah Paul</td><td>196</td><td>858</td><td>21</td><td>6</td><td>137</td></tr>
      <tr><td>4</td><td>Sights Impaired</td><td>Dan Barrington</td><td>215</td><td>891</td><td>26</td><td>6</td><td>132</td></tr>
      <tr><td>5</td><td>Shockers</td><td>Logan McKenna</td><td>196</td><td>895</td><td>21</td><td>7</td><td>126</td></tr>
      <tr><td>6</td><td>Smoking Guns</td><td>Gordon Larsen</td><td>201</td><td>885</td><td>24</td><td>7</td><td>124</td></tr>
      <tr><td>7</td><td>Bullshooters</td><td>Greg Litchfield</td><td>193</td><td>890</td><td>18</td><td>5</td><td>119</td></tr>
      <tr><td>8</td><td>Shell Shocked</td><td>Troy Johns</td><td>189</td><td>703</td><td>16</td><td>5</td><td>107</td></tr>
    </table>

    <h4><hr></h4>

    <h1>Week 4 Results</h1>
    <h5>Updated: 5/4/2025</h5>

    <h2>Standings (Week 4)</h2>
    <table class="standing-table">
      <tr><th>Standing</th><th>Team</th><th>Captain</th><th>Targets</th><th>Total Targets</th><th>Rank Points</th><th>Bonus Points</th><th>Total Points</th></tr>
      <tr><td>1</td><td>Missed Again</td><td>Loren Lamar</td><td>181</td><td>722</td><td>24</td><td>0</td><td>113</td></tr>
      <tr><td>2</td><td>Powder Burners</td><td>Sarah Paul</td><td>190</td><td>662</td><td>30</td><td>5</td><td>110</td></tr>
      <tr><td>3</td><td>Full Choke Artists</td><td>Randy Jones</td><td>189</td><td>713</td><td>28</td><td>5</td><td>106</td></tr>
      <tr><td>4</td><td>Sights Impaired</td><td>Dan Barrington</td><td>184</td><td>676</td><td>26</td><td>5</td><td>100</td></tr>
      <tr><td>5</td><td>Shockers</td><td>Logan McKenna</td><td>176</td><td>699</td><td>18</td><td>2</td><td>98</td></tr>
      <tr><td>6</td><td>Bullshooters</td><td>Greg Litchfield</td><td>179</td><td>697</td><td>20</td><td>1</td><td>96</td></tr>
      <tr><td>7</td><td>Smoking Guns</td><td>Gordon Larsen</td><td>180</td><td>684</td><td>22</td><td>6</td><td>93</td></tr>
      <tr><td>8</td><td>Shell Shocked</td><td>Troy Johns</td><td>0</td><td>514</td><td>16</td><td>0</td><td>86</td></tr>
    </table>

    <h4><hr></h4>

    <h1>Week 3 Results</h1>
    <h5>Updated: 4/25/2025</h5>

    <h2>Accolades</h2>
    <ul>
      <li><b>Anthony Schultz</b> from <i>Shockers</i> with a 25 straight!</li>
      <li><b>Ron Milby</b> from <i>Sights Impaired</i> with a 25 straight!</li>
    </ul>

    <h2>Standings (Week 3)</h2>
    <table class="standing-table">
      <tr><th>Standing</th><th>Team</th><th>Captain</th><th>Targets</th><th>Total Targets</th><th>Rank Points</th><th>Bonus Points</th><th>Total Points</th></tr>
      <tr><td>1</td><td>Missed Again</td><td>Loren Lamar</td><td>200</td><td>541</td><td>29</td><td>5</td><td>89</td></tr>
      <tr><td>2</td><td>Shockers</td><td>Logan McKenna</td><td>200</td><td>523</td><td>29</td><td>5</td><td>78</td></tr>
      <tr><td>3</td><td>Bullshooters</td><td>Greg Litchfield</td><td>185</td><td>518</td><td>22</td><td>5</td><td>75</td></tr>
      <tr><td>4</td><td>Powder Burners</td><td>Sarah Paul</td><td>188</td><td>472</td><td>26</td><td>5</td><td>75</td></tr>
      <tr><td>5</td><td>Full Choke Artists</td><td>Randy Jones</td><td>184</td><td>524</td><td>19</td><td>0</td><td>73</td></tr>
      <tr><td>6</td><td>Shell Shocked</td><td>Troy Johns</td><td>184</td><td>514</td><td>19</td><td>5</td><td>70</td></tr>
      <tr><td>7</td><td>Sights Impaired</td><td>Dan Barrington</td><td>187</td><td>492</td><td>24</td><td>5</td><td>69</td></tr>
      <tr><td>8</td><td>Smoking Guns</td><td>Gordon Larsen</td><td>182</td><td>504</td><td>16</td><td>6</td><td>65</td></tr>
    </table>

    <h4><hr></h4>

    <h1>Week 2 Results</h1>
    <h5>Updated: 4/17/2025</h5>

    <h2>Standings (Week 2)</h2>
    <table class="standing-table">
      <tr><th>Standing</th><th>Team</th><th>Captain</th><th>Targets</th><th>Total Targets</th><th>Rank Points</th><th>Bonus Points</th><th>Total Points</th></tr>
      <tr><td>1</td><td>Missed Again</td><td>Loren Lamar</td><td>153</td><td>341</td><td>20</td><td>0</td><td>55</td></tr>
      <tr><td>2</td><td>Full Choke Artists</td><td>Randy Jones</td><td>169</td><td>340</td><td>30</td><td>0</td><td>54</td></tr>
      <tr><td>3</td><td>Bullshooters</td><td>Greg Litchfield</td><td>161</td><td>333</td><td>22</td><td>0</td><td>48</td></tr>
      <tr><td>4</td><td>Shell Shocked</td><td>Troy Johns</td><td>164</td><td>330</td><td>26</td><td>0</td><td>46</td></tr>
      <tr><td>5</td><td>Shockers</td><td>Logan McKenna</td><td>165</td><td>323</td><td>28</td><td>0</td><td>44</td></tr>
      <tr><td>6</td><td>Powder Burners</td><td>Sarah Paul</td><td>101</td><td>284</td><td>16</td><td>0</td><td>44</td></tr>
      <tr><td>7</td><td>Smoking Guns</td><td>Gordon Larsen</td><td>162</td><td>322</td><td>24</td><td>1</td><td>43</td></tr>
      <tr><td>8</td><td>Sights Impaired</td><td>Dan Barrington</td><td>136</td><td>305</td><td>18</td><td>0</td><td>40</td></tr>
    </table>

    <h4><hr></h4>

    <h1>Week 1 Results</h1>
    <h5>Updated: 4/9/2025</h5>

    <h2>Accolades</h2>
    <ul>
      <li><b>Gary Garrett</b> from <i>Missed Again</i> with a 25 straight!</li>
    </ul>

    <h2>Standings (Week 1)</h2>
    <table class="standing-table">
      <tr><th>Standing</th><th>Team</th><th>Captain</th><th>Targets</th><th>Total Targets</th><th>Rank Points</th><th>Bonus Points</th><th>Total Points</th></tr>
      <tr><td>1</td><td>Missed Again</td><td>Loren Lamar</td><td>188</td><td>188</td><td>30</td><td>5</td><td>35</td></tr>
      <tr><td>2</td><td>Powder Burners</td><td>Sarah Paul</td><td>183</td><td>183</td><td>28</td><td>0</td><td>28</td></tr>
      <tr><td>3</td><td>Bullshooters</td><td>Greg Litchfield</td><td>172</td><td>172</td><td>26</td><td>0</td><td>26</td></tr>
      <tr><td>4</td><td>Full Choke Artists</td><td>Randy Jones</td><td>171</td><td>171</td><td>24</td><td>0</td><td>24</td></tr>
      <tr><td>5</td><td>Sights Impaired</td><td>Dan Barrington</td><td>169</td><td>169</td><td>22</td><td>0</td><td>22</td></tr>
      <tr><td>6</td><td>Shell Shocked</td><td>Troy Johns</td><td>166</td><td>166</td><td>20</td><td>0</td><td>20</td></tr>
      <tr><td>7</td><td>Smoking Guns</td><td>Gordon Larsen</td><td>160</td><td>160</td><td>18</td><td>0</td><td>18</td></tr>
      <tr><td>8</td><td>Shockers</td><td>Logan McKenna</td><td>158</td><td>158</td><td>16</td><td>0</td><td>16</td></tr>
    </table>

    <h4><hr></h4>

    <h1>2025 Season Kickoff</h1>
    <h5>Updated: 2/24/2025</h5>

    <p>The 2025 league will officially kick off on Tuesday, April 8th.</p>

    <p>
      To sign up, send an email to <a href="mailto:tyler.citl@gmail.com">tyler.citl@gmail.com</a>
      by Friday, April 4th with the following information:
    </p>
    <ul>
      <li>Team Name</li>
      <li>Captain's name, email, and phone number</li>
      <li>Team member names and email</li>
    </ul>
    <p>If signing up as an individual, send your name and email and we will work with existing
    teams for placement.</p>

    <p>For more information about league fees and location check the
    <a href="#/about">About</a> page.</p>

    <h2>Schedule</h2>

    <p>
      An informal practice day will be held the Tuesday before the league starts (4/1/2025).
      This is a great time to meet up with other shooters and work off some cobwebs from last season.
    </p>

    <div style="text-align: center;">
      <img style="padding: 0px" src="/assets/images/2025_season_calendar_april.png" alt="2025 Season Calendar April">
      <img style="padding: 0px" src="/assets/images/2025_season_calendar_may.png" alt="2025 Season Calendar May">
      <img style="padding: 0px" src="/assets/images/2025_season_calendar_june.png" alt="2025 Season Calendar June">
      <img style="padding: 0px" src="/assets/images/2025_season_calendar_july.png" alt="2025 Season Calendar July">
    </div>
  `;
}
