/**
 * scorecardsView — Per-team collapsible scorecards for the 2025 season
 *
 * Migrated from src/spa/scorecards.html (main content only).
 * Changes from original:
 * - Blank 9th team template removed
 * - Collapsible accordion logic moved to initCollapsibles() in main.js
 */

/**
 * Returns the HTML string for the scorecards view.
 * @returns {string}
 */
export function scorecardsView() {
  return `
    <h2>2025 Scorecards</h2>

    <button class="collapsible">Bullshooters</button>
    <div class="scorecard">
      <table class="scorecard-tables">
        <tr><th></th><th></th><th>W0</th><th>W1</th><th>W2</th><th>W3</th><th>W4</th><th>W5</th><th>W6</th><th>W7</th><th>W8</th><th>W9</th><th>W10</th><th>W11</th><th>W12</th><th>W13</th><th>W14</th><th>W15</th><th>Weeks Shot</th><th>Avg</th></tr>
        <tr><td>Greg Litchfield</td><td></td><td>39.9</td><td>38</td><td>-</td><td>38</td><td>34</td><td>-</td><td>43</td><td>39</td><td>-</td><td>45</td><td>35</td><td>39</td><td>40</td><td>33</td><td>-</td><td>-</td><td>10</td><td>38.4</td></tr>
        <tr><td>Bill Murphy</td><td></td><td>38.7</td><td>-</td><td>-</td><td>-</td><td>38</td><td>37</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>36</td><td>40</td><td>38</td><td>5</td><td>37.8</td></tr>
        <tr><td>Ken Sutter</td><td></td><td>36.9</td><td>32</td><td>34</td><td>33</td><td>-</td><td>44</td><td>44</td><td>36</td><td>-</td><td>38</td><td>36</td><td>-</td><td>-</td><td>38</td><td>39</td><td>-</td><td>10</td><td>37.4</td></tr>
        <tr><td>Nestor Gutierrez</td><td></td><td>40.1</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>40.1</td></tr>
        <tr><td>Howard Hallstein</td><td></td><td>36.2</td><td>34</td><td>28</td><td>38</td><td>-</td><td>33</td><td>39</td><td>-</td><td>42</td><td>-</td><td>45</td><td>44</td><td>40</td><td>35</td><td>-</td><td>36</td><td>11</td><td>37.6</td></tr>
        <tr><td>Terry Garbe</td><td></td><td>39.0</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>39.0</td></tr>
        <tr><td>Bruce Schenkel</td><td></td><td>38.8</td><td>-</td><td>-</td><td>35</td><td>-</td><td>-</td><td>-</td><td>-</td><td>35</td><td>-</td><td>-</td><td>-</td><td>37</td><td>-</td><td>37</td><td>36</td><td>5</td><td>36.0</td></tr>
        <tr><td>Lindsay Bourda</td><td></td><td>41.7</td><td>40</td><td>41</td><td>41</td><td>40</td><td>45</td><td>-</td><td>41</td><td>44</td><td>43</td><td>38</td><td>46</td><td>45</td><td>42</td><td>43</td><td>47</td><td>14</td><td>42.6</td></tr>
        <tr><td>Mike Litwiller</td><td></td><td>36.9</td><td>-</td><td>31</td><td>-</td><td>37</td><td>-</td><td>32</td><td>-</td><td>-</td><td>43</td><td>-</td><td>43</td><td>-</td><td>-</td><td>-</td><td>-</td><td>5</td><td>37.2</td></tr>
        <tr><td>Greg McNeely</td><td></td><td>35.0</td><td>28</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>36</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>2</td><td>32.0</td></tr>
        <tr><td>Cory Steers</td><td>R</td><td>35.0</td><td>-</td><td>-</td><td>-</td><td>-</td><td>34</td><td>-</td><td>30</td><td>32</td><td>-</td><td>-</td><td>-</td><td>33</td><td>-</td><td>-</td><td>32</td><td>5</td><td>32.2</td></tr>
        <tr><td>Nathan Steers</td><td>R</td><td>35.0</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>29</td><td>36</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>2</td><td>32.5</td></tr>
        <tr><td>Randy Litwiller</td><td>R</td><td>35.0</td><td>-</td><td>27</td><td>-</td><td>30</td><td>-</td><td>32</td><td>-</td><td>-</td><td>42</td><td>-</td><td>36</td><td>-</td><td>-</td><td>34</td><td>-</td><td>6</td><td>33.5</td></tr>
        <tr><td>Bullshooters DUMMY1</td><td></td><td>34.4</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>34.4</td></tr>
        <tr><td>Bullshooters DUMMY2</td><td></td><td>34.4</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>34.4</td></tr>
        <tr><td>TOTAL TARGETS</td><td></td><td></td><td>172</td><td>161</td><td>185</td><td>179</td><td>193</td><td>190</td><td>175</td><td>189</td><td>211</td><td>190</td><td>208</td><td>195</td><td>184</td><td>193</td><td>189</td><td></td><td></td></tr>
        <tr><td>RANK POINTS</td><td></td><td></td><td>26</td><td>22</td><td>22</td><td>20</td><td>18</td><td>19</td><td>16</td><td>18</td><td>30</td><td>27</td><td>30</td><td>23</td><td>16</td><td>26</td><td>19</td><td></td><td></td></tr>
        <tr><td>BONUS POINTS</td><td></td><td></td><td>-</td><td>-</td><td>5</td><td>1</td><td>5</td><td>6</td><td>1</td><td>7</td><td>6</td><td>5</td><td>5</td><td>5</td><td>-</td><td>5</td><td>5</td><td></td><td></td></tr>
      </table>
    </div>

    <button class="collapsible">Full Choke Artists</button>
    <div class="scorecard">
      <table class="scorecard-tables">
        <tr><th></th><th></th><th>W0</th><th>W1</th><th>W2</th><th>W3</th><th>W4</th><th>W5</th><th>W6</th><th>W7</th><th>W8</th><th>W9</th><th>W10</th><th>W11</th><th>W12</th><th>W13</th><th>W14</th><th>W15</th><th>Weeks Shot</th><th>Avg</th></tr>
        <tr><td>Randy Jones</td><td></td><td>44.7</td><td>-</td><td>40</td><td>-</td><td>-</td><td>48</td><td>-</td><td>-</td><td>-</td><td>43</td><td>42</td><td>-</td><td>49</td><td>-</td><td>41</td><td>48</td><td>7</td><td>44.4</td></tr>
        <tr><td>Jeff Abel</td><td></td><td>41.9</td><td>36</td><td>-</td><td>-</td><td>41</td><td>-</td><td>48</td><td>-</td><td>-</td><td>41</td><td>38</td><td>-</td><td>41</td><td>46</td><td>-</td><td>-</td><td>7</td><td>41.6</td></tr>
        <tr><td>Rod Dale</td><td></td><td>40.5</td><td>-</td><td>30</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>1</td><td>35.3</td></tr>
        <tr><td>Neal Percival</td><td></td><td>33.0</td><td>-</td><td>24</td><td>-</td><td>26</td><td>-</td><td>41</td><td>-</td><td>38</td><td>-</td><td>31</td><td>-</td><td>23</td><td>-</td><td>-</td><td>36</td><td>7</td><td>31.3</td></tr>
        <tr><td>Mark Gauding</td><td></td><td>37.9</td><td>-</td><td>-</td><td>37</td><td>-</td><td>-</td><td>-</td><td>35</td><td>-</td><td>-</td><td>34</td><td>-</td><td>-</td><td>26</td><td>-</td><td>-</td><td>4</td><td>33.0</td></tr>
        <tr><td>Scott Petri</td><td></td><td>35.2</td><td>-</td><td>-</td><td>28</td><td>-</td><td>-</td><td>-</td><td>28</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>27</td><td>-</td><td>3</td><td>27.7</td></tr>
        <tr><td>Scott Gould</td><td></td><td>32.1</td><td>23</td><td>-</td><td>-</td><td>-</td><td>38</td><td>-</td><td>34</td><td>-</td><td>-</td><td>-</td><td>-</td><td>34</td><td>30</td><td>30</td><td>33</td><td>7</td><td>31.7</td></tr>
        <tr><td>Dave Jones</td><td></td><td>37.0</td><td>35</td><td>-</td><td>38</td><td>-</td><td>46</td><td>-</td><td>46</td><td>43</td><td>34</td><td>-</td><td>39</td><td>-</td><td>-</td><td>-</td><td>42</td><td>8</td><td>40.4</td></tr>
        <tr><td>Branden Sholty</td><td></td><td>45.6</td><td>37</td><td>-</td><td>40</td><td>41</td><td>-</td><td>42</td><td>-</td><td>43</td><td>45</td><td>-</td><td>37</td><td>-</td><td>47</td><td>47</td><td>-</td><td>9</td><td>42.1</td></tr>
        <tr><td>Giedrius Rakauskas</td><td></td><td>39.3</td><td>40</td><td>-</td><td>41</td><td>42</td><td>-</td><td>45</td><td>-</td><td>41</td><td>-</td><td>-</td><td>38</td><td>-</td><td>-</td><td>-</td><td>-</td><td>6</td><td>41.2</td></tr>
        <tr><td>Brad Allen</td><td></td><td>39.1</td><td>-</td><td>34</td><td>-</td><td>39</td><td>46</td><td>47</td><td>-</td><td>42</td><td>40</td><td>-</td><td>41</td><td>44</td><td>-</td><td>-</td><td>39</td><td>9</td><td>41.3</td></tr>
        <tr><td>Micheal Benjamin</td><td>R</td><td>35.0</td><td>-</td><td>41</td><td>-</td><td>-</td><td>45</td><td>-</td><td>46</td><td>-</td><td>-</td><td>34</td><td>44</td><td>-</td><td>46</td><td>47</td><td>-</td><td>7</td><td>43.3</td></tr>
        <tr><td>Artists DUMMY1</td><td></td><td>34.2</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>34.2</td></tr>
        <tr><td>Artists DUMMY2</td><td></td><td>34.2</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>34.2</td></tr>
        <tr><td>TOTAL TARGETS</td><td></td><td></td><td>171</td><td>169</td><td>184</td><td>189</td><td>223</td><td>223</td><td>189</td><td>207</td><td>203</td><td>179</td><td>199</td><td>191</td><td>195</td><td>192</td><td>198</td><td></td><td></td></tr>
        <tr><td>RANK POINTS</td><td></td><td></td><td>24</td><td>30</td><td>19</td><td>28</td><td>30</td><td>30</td><td>19</td><td>30</td><td>26</td><td>20</td><td>20</td><td>20</td><td>22</td><td>24</td><td>28</td><td></td><td></td></tr>
        <tr><td>BONUS POINTS</td><td></td><td></td><td>-</td><td>-</td><td>-</td><td>5</td><td>5</td><td>5</td><td>5</td><td>5</td><td>-</td><td>-</td><td>-</td><td>5</td><td>5</td><td>5</td><td>5</td><td></td><td></td></tr>
      </table>
    </div>

    <button class="collapsible">Missed Again</button>
    <div class="scorecard">
      <table class="scorecard-tables">
        <tr><th></th><th></th><th>W0</th><th>W1</th><th>W2</th><th>W3</th><th>W4</th><th>W5</th><th>W6</th><th>W7</th><th>W8</th><th>W9</th><th>W10</th><th>W11</th><th>W12</th><th>W13</th><th>W14</th><th>W15</th><th>Weeks Shot</th><th>Avg</th></tr>
        <tr><td>Loren Lamar</td><td></td><td>39.0</td><td>38</td><td>31</td><td>43</td><td>33</td><td>46</td><td>47</td><td>47</td><td>39</td><td>-</td><td>30</td><td>-</td><td>-</td><td>36</td><td>39</td><td>38</td><td>12</td><td>38.9</td></tr>
        <tr><td>Gary Garrett</td><td></td><td>42.9</td><td>49</td><td>24</td><td>45</td><td>34</td><td>44</td><td>50</td><td>40</td><td>44</td><td>41</td><td>39</td><td>42</td><td>45</td><td>45</td><td>38</td><td>44</td><td>15</td><td>41.6</td></tr>
        <tr><td>Dan Riccolo</td><td></td><td>35.0</td><td>24</td><td>36</td><td>37</td><td>35</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>4</td><td>33.0</td></tr>
        <tr><td>Steve Robbins</td><td></td><td>44.0</td><td>-</td><td>-</td><td>45</td><td>37</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>2</td><td>41.0</td></tr>
        <tr><td>Arthur Parks</td><td></td><td>28.7</td><td>32</td><td>25</td><td>30</td><td>-</td><td>-</td><td>34</td><td>31</td><td>34</td><td>27</td><td>-</td><td>32</td><td>29</td><td>24</td><td>-</td><td>22</td><td>11</td><td>29.1</td></tr>
        <tr><td>Dave Coale</td><td></td><td>42.0</td><td>45</td><td>37</td><td>-</td><td>-</td><td>45</td><td>45</td><td>46</td><td>42</td><td>45</td><td>44</td><td>41</td><td>34</td><td>45</td><td>38</td><td>40</td><td>13</td><td>42.1</td></tr>
        <tr><td>Ben Dittmar</td><td></td><td>39.9</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>39.9</td></tr>
        <tr><td>Adam McVey</td><td></td><td>39.0</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>45</td><td>43</td><td>42</td><td>36</td><td>-</td><td>4</td><td>41.5</td></tr>
        <tr><td>Al Kocar</td><td></td><td>41.0</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>45</td><td>-</td><td>40</td><td>-</td><td>-</td><td>-</td><td>-</td><td>2</td><td>42.5</td></tr>
        <tr><td>Jim Sloan</td><td>R</td><td>35.0</td><td>-</td><td>-</td><td>-</td><td>-</td><td>41</td><td>42</td><td>43</td><td>39</td><td>35</td><td>35</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>6</td><td>39.2</td></tr>
        <tr><td>Ed Lechleiter</td><td>R</td><td>35.0</td><td>-</td><td>-</td><td>-</td><td>-</td><td>42</td><td>-</td><td>-</td><td>-</td><td>-</td><td>29</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>2</td><td>35.5</td></tr>
        <tr><td>Sub (Ron Milby)</td><td></td><td>45.5</td><td>-</td><td>-</td><td>-</td><td>42</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>47</td><td>-</td><td>45</td><td>45</td><td>4</td><td>44.8</td></tr>
        <tr><td>Again DUMMY1</td><td></td><td>37.6</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>37.6</td></tr>
        <tr><td>Again DUMMY2</td><td></td><td>37.6</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>37.6</td></tr>
        <tr><td>TOTAL TARGETS</td><td></td><td></td><td>188</td><td>153</td><td>200</td><td>181</td><td>218</td><td>218</td><td>207</td><td>198</td><td>193</td><td>177</td><td>200</td><td>198</td><td>192</td><td>196</td><td>189</td><td></td><td></td></tr>
        <tr><td>RANK POINTS</td><td></td><td></td><td>30</td><td>20</td><td>29</td><td>24</td><td>28</td><td>28</td><td>30</td><td>24</td><td>22</td><td>18</td><td>22</td><td>28</td><td>19</td><td>28</td><td>19</td><td></td><td></td></tr>
        <tr><td>BONUS POINTS</td><td></td><td></td><td>5</td><td>-</td><td>5</td><td>-</td><td>5</td><td>5</td><td>5</td><td>5</td><td>-</td><td>-</td><td>5</td><td>-</td><td>-</td><td>-</td><td>-</td><td></td><td></td></tr>
      </table>
    </div>

    <button class="collapsible">Powder Burners</button>
    <div class="scorecard">
      <table class="scorecard-tables">
        <tr><th></th><th></th><th>W0</th><th>W1</th><th>W2</th><th>W3</th><th>W4</th><th>W5</th><th>W6</th><th>W7</th><th>W8</th><th>W9</th><th>W10</th><th>W11</th><th>W12</th><th>W13</th><th>W14</th><th>W15</th><th>Weeks Shot</th><th>Avg</th></tr>
        <tr><td>Sarah Paul</td><td></td><td>38.0</td><td>36</td><td>-</td><td>41</td><td>42</td><td>36</td><td>39</td><td>-</td><td>45</td><td>41</td><td>43</td><td>44</td><td>43</td><td>41</td><td>36</td><td>43</td><td>13</td><td>40.8</td></tr>
        <tr><td>Randy Paul</td><td></td><td>38.8</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>38.8</td></tr>
        <tr><td>Jamie Spencer</td><td></td><td>33.1</td><td>-</td><td>-</td><td>-</td><td>35</td><td>-</td><td>-</td><td>36</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>28</td><td>-</td><td>3</td><td>33.0</td></tr>
        <tr><td>Brandon Compton</td><td>R</td><td>35.0</td><td>-</td><td>-</td><td>-</td><td>41</td><td>39</td><td>43</td><td>45</td><td>43</td><td>35</td><td>-</td><td>35</td><td>35</td><td>-</td><td>41</td><td>-</td><td>9</td><td>39.7</td></tr>
        <tr><td>Laurin Bartelmay</td><td></td><td>43.1</td><td>-</td><td>36</td><td>45</td><td>47</td><td>46</td><td>-</td><td>42</td><td>40</td><td>41</td><td>39</td><td>38</td><td>37</td><td>47</td><td>40</td><td>39</td><td>13</td><td>41.3</td></tr>
        <tr><td>Mandy Lane</td><td></td><td>27.0</td><td>-</td><td>-</td><td>29</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>1</td><td>28.0</td></tr>
        <tr><td>Macy Lane</td><td></td><td>37.0</td><td>28</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>1</td><td>32.5</td></tr>
        <tr><td>Matt Lane</td><td>R</td><td>35.0</td><td>44</td><td>-</td><td>38</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>2</td><td>41.0</td></tr>
        <tr><td>Jim Williams</td><td></td><td>39.6</td><td>42</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>1</td><td>40.8</td></tr>
        <tr><td>Dustin Carter</td><td></td><td>33.3</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>34</td><td>-</td><td>-</td><td>-</td><td>28</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>2</td><td>31.0</td></tr>
        <tr><td>Floyd Bartelmay</td><td></td><td>34.4</td><td>-</td><td>9</td><td>-</td><td>25</td><td>-</td><td>41</td><td>-</td><td>40</td><td>-</td><td>42</td><td>-</td><td>41</td><td>44</td><td>-</td><td>42</td><td>8</td><td>35.5</td></tr>
        <tr><td>Mike Burton</td><td>R</td><td>35.0</td><td>-</td><td>22</td><td>-</td><td>-</td><td>40</td><td>32</td><td>-</td><td>-</td><td>-</td><td>34</td><td>-</td><td>-</td><td>-</td><td>-</td><td>35</td><td>5</td><td>32.6</td></tr>
        <tr><td>Luke Werts</td><td>R</td><td>35.0</td><td>-</td><td>-</td><td>35</td><td>-</td><td>35</td><td>-</td><td>35</td><td>-</td><td>36</td><td>-</td><td>35</td><td>-</td><td>44</td><td>-</td><td>-</td><td>6</td><td>36.7</td></tr>
        <tr><td>Dave Kemper</td><td>R</td><td>35.0</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>35.0</td></tr>
        <tr><td>Dave Schlattman</td><td>R</td><td>35.0</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>39</td><td>36</td><td>39</td><td>-</td><td>32</td><td>33</td><td>42</td><td>25</td><td>-</td><td>7</td><td>35.1</td></tr>
        <tr><td>Burners DUMMY1</td><td></td><td>37.5</td><td>33</td><td>17</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>35</td><td>3</td><td>28.3</td></tr>
        <tr><td>Burners DUMMY2</td><td></td><td>37.5</td><td>-</td><td>17</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>1</td><td>27.3</td></tr>
        <tr><td>TOTAL TARGETS</td><td></td><td></td><td>183</td><td>101</td><td>188</td><td>190</td><td>196</td><td>189</td><td>197</td><td>204</td><td>192</td><td>186</td><td>184</td><td>189</td><td>218</td><td>170</td><td>194</td><td>-</td><td></td></tr>
        <tr><td>RANK POINTS</td><td></td><td></td><td>28</td><td>16</td><td>26</td><td>30</td><td>21</td><td>16</td><td>23</td><td>28</td><td>20</td><td>24</td><td>18</td><td>18</td><td>30</td><td>18</td><td>22</td><td>-</td><td></td></tr>
        <tr><td>BONUS POINTS</td><td></td><td></td><td>-</td><td>-</td><td>5</td><td>5</td><td>6</td><td>6</td><td>5</td><td>5</td><td>-</td><td>6</td><td>-</td><td>-</td><td>5</td><td>-</td><td>5</td><td>-</td><td></td></tr>
      </table>
    </div>

    <button class="collapsible">Shell Shocked</button>
    <div class="scorecard">
      <table class="scorecard-tables">
        <tr><th></th><th></th><th>W0</th><th>W1</th><th>W2</th><th>W3</th><th>W4</th><th>W5</th><th>W6</th><th>W7</th><th>W8</th><th>W9</th><th>W10</th><th>W11</th><th>W12</th><th>W13</th><th>W14</th><th>W15</th><th>Weeks Shot</th><th>Avg</th></tr>
        <tr><td>Troy Johns</td><td></td><td>42.0</td><td>-</td><td>45</td><td>-</td><td>-</td><td>42</td><td>-</td><td>-</td><td>39</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>42</td><td>41</td><td>5</td><td>41.8</td></tr>
        <tr><td>Marc Herren</td><td></td><td>35.9</td><td>36</td><td>41</td><td>41</td><td>-</td><td>48</td><td>44</td><td>44</td><td>44</td><td>31</td><td>41</td><td>41</td><td>39</td><td>46</td><td>42</td><td>44</td><td>14</td><td>41.6</td></tr>
        <tr><td>Gary Hopf</td><td></td><td>36.9</td><td>26</td><td>30</td><td>39</td><td>-</td><td>35</td><td>37</td><td>-</td><td>37</td><td>36</td><td>32</td><td>33</td><td>-</td><td>36</td><td>-</td><td>30</td><td>11</td><td>33.7</td></tr>
        <tr><td>Adam Hopf</td><td></td><td>38.2</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>31</td><td>31</td><td>31</td><td>21</td><td>-</td><td>40</td><td>-</td><td>44</td><td>47</td><td>7</td><td>35.0</td></tr>
        <tr><td>Carter Johns</td><td></td><td>13.0</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>13.0</td></tr>
        <tr><td>Tyler Kupferschmid</td><td></td><td>37.4</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>40</td><td>-</td><td>-</td><td>39</td><td>-</td><td>-</td><td>2</td><td>39.5</td></tr>
        <tr><td>Tyler DeKnecht</td><td></td><td>43.0</td><td>38</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>1</td><td>40.5</td></tr>
        <tr><td>Rob Johnson</td><td></td><td>41.0</td><td>37</td><td>-</td><td>44</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>39</td><td>-</td><td>-</td><td>39</td><td>-</td><td>41</td><td>37</td><td>6</td><td>39.5</td></tr>
        <tr><td>Bob Benjamin</td><td></td><td>27.7</td><td>-</td><td>30</td><td>27</td><td>-</td><td>30</td><td>-</td><td>38</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>37</td><td>-</td><td>-</td><td>5</td><td>32.4</td></tr>
        <tr><td>J.T. Bedell</td><td>R</td><td>35.0</td><td>-</td><td>18</td><td>-</td><td>-</td><td>-</td><td>22</td><td>31</td><td>26</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>29</td><td>-</td><td>5</td><td>25.2</td></tr>
        <tr><td>Tal Parmenter</td><td>R</td><td>35.0</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>50</td><td>45</td><td>-</td><td>39</td><td>-</td><td>37</td><td>42</td><td>-</td><td>-</td><td>-</td><td>5</td><td>42.6</td></tr>
        <tr><td>Damien Locke</td><td>R</td><td>35.0</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>44</td><td>-</td><td>-</td><td>-</td><td>-</td><td>28</td><td>42</td><td>45</td><td>-</td><td>-</td><td>4</td><td>39.8</td></tr>
        <tr><td>Shocked DUMMY1</td><td></td><td>34.3</td><td>29</td><td>-</td><td>33</td><td>-</td><td>34</td><td>-</td><td>-</td><td>-</td><td>-</td><td>29</td><td>30</td><td>-</td><td>-</td><td>-</td><td>-</td><td>5</td><td>31.0</td></tr>
        <tr><td>Shocked DUMMY2</td><td></td><td>34.3</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>34.3</td></tr>
        <tr><td>TOTAL TARGETS</td><td></td><td></td><td>166</td><td>164</td><td>184</td><td>-</td><td>189</td><td>197</td><td>189</td><td>177</td><td>176</td><td>163</td><td>169</td><td>202</td><td>203</td><td>198</td><td>199</td><td>-</td><td></td></tr>
        <tr><td>RANK POINTS</td><td></td><td></td><td>20</td><td>26</td><td>19</td><td>16</td><td>16</td><td>23</td><td>19</td><td>16</td><td>16</td><td>16</td><td>16</td><td>30</td><td>26</td><td>30</td><td>30</td><td>-</td><td></td></tr>
        <tr><td>BONUS POINTS</td><td></td><td></td><td>-</td><td>-</td><td>5</td><td>-</td><td>5</td><td>6</td><td>6</td><td>1</td><td>-</td><td>-</td><td>-</td><td>5</td><td>5</td><td>5</td><td>5</td><td>-</td><td></td></tr>
      </table>
    </div>

    <button class="collapsible">Shockers</button>
    <div class="scorecard">
      <table class="scorecard-tables">
        <tr><th></th><th></th><th>W0</th><th>W1</th><th>W2</th><th>W3</th><th>W4</th><th>W5</th><th>W6</th><th>W7</th><th>W8</th><th>W9</th><th>W10</th><th>W11</th><th>W12</th><th>W13</th><th>W14</th><th>W15</th><th>Weeks Shot</th><th>Avg</th></tr>
        <tr><td>Logan McKenna</td><td></td><td>36.9</td><td>28</td><td>32</td><td>44</td><td>-</td><td>43</td><td>40</td><td>39</td><td>40</td><td>46</td><td>42</td><td>44</td><td>33</td><td>42</td><td>31</td><td>38</td><td>14</td><td>38.7</td></tr>
        <tr><td>David Goveia</td><td></td><td>35.5</td><td>28</td><td>39</td><td>-</td><td>-</td><td>-</td><td>-</td><td>42</td><td>-</td><td>-</td><td>36</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>4</td><td>36.3</td></tr>
        <tr><td>Anthony Schultz</td><td></td><td>44.0</td><td>-</td><td>36</td><td>49</td><td>42</td><td>-</td><td>41</td><td>-</td><td>45</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>5</td><td>42.6</td></tr>
        <tr><td>Dennis Wright</td><td></td><td>36.5</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>36</td><td>-</td><td>31</td><td>-</td><td>34</td><td>-</td><td>3</td><td>33.7</td></tr>
        <tr><td>Cari Shields</td><td></td><td>31.0</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>31.0</td></tr>
        <tr><td>Brian Dehart</td><td></td><td>29.0</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>29.0</td></tr>
        <tr><td>Rob Glinka</td><td></td><td>33.7</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>33.7</td></tr>
        <tr><td>Austin Beyer</td><td></td><td>37.5</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>37.5</td></tr>
        <tr><td>Dan Riddle</td><td></td><td>37.5</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>37.5</td></tr>
        <tr><td>Matt Lamb</td><td></td><td>40.6</td><td>39</td><td>41</td><td>41</td><td>43</td><td>47</td><td>46</td><td>42</td><td>46</td><td>45</td><td>46</td><td>45</td><td>40</td><td>47</td><td>36</td><td>48</td><td>15</td><td>43.5</td></tr>
        <tr><td>Ezra Lamb</td><td>R</td><td>35.0</td><td>-</td><td>17</td><td>-</td><td>16</td><td>26</td><td>22</td><td>-</td><td>16</td><td>26</td><td>-</td><td>39</td><td>-</td><td>35</td><td>-</td><td>34</td><td>9</td><td>25.7</td></tr>
        <tr><td>Eric Bell</td><td></td><td>40.8</td><td>35</td><td>-</td><td>36</td><td>45</td><td>43</td><td>41</td><td>42</td><td>47</td><td>46</td><td>-</td><td>44</td><td>42</td><td>44</td><td>45</td><td>41</td><td>13</td><td>42.4</td></tr>
        <tr><td>Chris Anthony</td><td>R</td><td>35.0</td><td>-</td><td>-</td><td>30</td><td>30</td><td>37</td><td>-</td><td>37</td><td>-</td><td>24</td><td>30</td><td>32</td><td>35</td><td>40</td><td>34</td><td>36</td><td>11</td><td>33.2</td></tr>
        <tr><td>Shockers DUMMY1</td><td></td><td>32.5</td><td>28</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>1</td><td>30.3</td></tr>
        <tr><td>Shockers DUMMY2</td><td></td><td>32.5</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>32.5</td></tr>
        <tr><td>TOTAL TARGETS</td><td></td><td></td><td>158</td><td>165</td><td>200</td><td>176</td><td>196</td><td>190</td><td>202</td><td>194</td><td>187</td><td>190</td><td>204</td><td>181</td><td>208</td><td>180</td><td>197</td><td>-</td><td></td></tr>
        <tr><td>RANK POINTS</td><td></td><td></td><td>16</td><td>28</td><td>29</td><td>18</td><td>21</td><td>19</td><td>28</td><td>22</td><td>18</td><td>27</td><td>28</td><td>16</td><td>28</td><td>22</td><td>25</td><td>-</td><td></td></tr>
        <tr><td>BONUS POINTS</td><td></td><td></td><td>-</td><td>-</td><td>5</td><td>2</td><td>7</td><td>6</td><td>6</td><td>6</td><td>7</td><td>6</td><td>5</td><td>-</td><td>5</td><td>-</td><td>5</td><td>-</td><td></td></tr>
      </table>
    </div>

    <button class="collapsible">Sights Impaired</button>
    <div class="scorecard">
      <table class="scorecard-tables">
        <tr><th></th><th></th><th>W0</th><th>W1</th><th>W2</th><th>W3</th><th>W4</th><th>W5</th><th>W6</th><th>W7</th><th>W8</th><th>W9</th><th>W10</th><th>W11</th><th>W12</th><th>W13</th><th>W14</th><th>W15</th><th>Weeks Shot</th><th>Avg</th></tr>
        <tr><td>Dan Barrington</td><td></td><td>35.7</td><td>31</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>44</td><td>-</td><td>35</td><td>34</td><td>41</td><td>34</td><td>-</td><td>35</td><td>7</td><td>36.3</td></tr>
        <tr><td>Jack Vick</td><td></td><td>40.4</td><td>-</td><td>32</td><td>-</td><td>36</td><td>-</td><td>44</td><td>42</td><td>31</td><td>-</td><td>-</td><td>42</td><td>38</td><td>-</td><td>34</td><td>42</td><td>9</td><td>37.9</td></tr>
        <tr><td>Mark Cabaj</td><td></td><td>31.4</td><td>-</td><td>14</td><td>-</td><td>34</td><td>-</td><td>35</td><td>-</td><td>-</td><td>33</td><td>-</td><td>-</td><td>38</td><td>-</td><td>33</td><td>37</td><td>7</td><td>32.0</td></tr>
        <tr><td>Allen Cary</td><td></td><td>40.8</td><td>-</td><td>-</td><td>-</td><td>31</td><td>42</td><td>46</td><td>-</td><td>42</td><td>45</td><td>45</td><td>43</td><td>-</td><td>-</td><td>-</td><td>42</td><td>8</td><td>42.0</td></tr>
        <tr><td>Michael Freimann</td><td></td><td>38.5</td><td>31</td><td>17</td><td>41</td><td>39</td><td>-</td><td>-</td><td>42</td><td>-</td><td>43</td><td>43</td><td>41</td><td>-</td><td>-</td><td>-</td><td>41</td><td>9</td><td>37.6</td></tr>
        <tr><td>Shannon McMahon</td><td></td><td>38.0</td><td>29</td><td>-</td><td>36</td><td>-</td><td>-</td><td>48</td><td>-</td><td>41</td><td>40</td><td>-</td><td>-</td><td>44</td><td>41</td><td>41</td><td>-</td><td>8</td><td>40.0</td></tr>
        <tr><td>Rich Drennen</td><td></td><td>46.0</td><td>44</td><td>34</td><td>-</td><td>-</td><td>49</td><td>-</td><td>48</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>4</td><td>43.8</td></tr>
        <tr><td>Ron Milby</td><td></td><td>45.5</td><td>-</td><td>39</td><td>48</td><td>44</td><td>48</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>49</td><td>-</td><td>-</td><td>5</td><td>45.6</td></tr>
        <tr><td>Mike Brewer</td><td></td><td>40.8</td><td>34</td><td>-</td><td>32</td><td>-</td><td>43</td><td>44</td><td>43</td><td>41</td><td>-</td><td>41</td><td>42</td><td>-</td><td>38</td><td>40</td><td>-</td><td>10</td><td>39.8</td></tr>
        <tr><td>Pamela Ross</td><td>R</td><td>35.0</td><td>-</td><td>-</td><td>30</td><td>-</td><td>33</td><td>-</td><td>24</td><td>-</td><td>37</td><td>41</td><td>-</td><td>36</td><td>34</td><td>31</td><td>-</td><td>8</td><td>33.3</td></tr>
        <tr><td>Impaired DUMMY1</td><td></td><td>33.8</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>33.8</td></tr>
        <tr><td>Impaired DUMMY2</td><td></td><td>33.8</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>33.8</td></tr>
        <tr><td>TOTAL TARGETS</td><td></td><td></td><td>169</td><td>136</td><td>187</td><td>184</td><td>215</td><td>217</td><td>199</td><td>199</td><td>198</td><td>205</td><td>202</td><td>197</td><td>196</td><td>179</td><td>197</td><td>-</td><td></td></tr>
        <tr><td>RANK POINTS</td><td></td><td></td><td>22</td><td>18</td><td>24</td><td>26</td><td>26</td><td>26</td><td>26</td><td>26</td><td>24</td><td>30</td><td>26</td><td>26</td><td>24</td><td>20</td><td>25</td><td>-</td><td></td></tr>
        <tr><td>BONUS POINTS</td><td></td><td></td><td>-</td><td>-</td><td>5</td><td>5</td><td>6</td><td>5</td><td>6</td><td>5</td><td>6</td><td>6</td><td>5</td><td>5</td><td>5</td><td>-</td><td>5</td><td>-</td><td></td></tr>
      </table>
    </div>

    <button class="collapsible">Smoking Guns</button>
    <div class="scorecard">
      <table class="scorecard-tables">
        <tr><th></th><th></th><th>W0</th><th>W1</th><th>W2</th><th>W3</th><th>W4</th><th>W5</th><th>W6</th><th>W7</th><th>W8</th><th>W9</th><th>W10</th><th>W11</th><th>W12</th><th>W13</th><th>W14</th><th>W15</th><th>Weeks Shot</th><th>Avg</th></tr>
        <tr><td>Gordon Larsen</td><td></td><td>39.8</td><td>38</td><td>-</td><td>40</td><td>41</td><td>-</td><td>38</td><td>39</td><td>-</td><td>44</td><td>44</td><td>45</td><td>-</td><td>-</td><td>35</td><td>-</td><td>9</td><td>40.4</td></tr>
        <tr><td>Jamie Beilfuss</td><td></td><td>39.0</td><td>-</td><td>33</td><td>42</td><td>38</td><td>41</td><td>42</td><td>-</td><td>42</td><td>43</td><td>34</td><td>-</td><td>38</td><td>-</td><td>-</td><td>-</td><td>9</td><td>39.2</td></tr>
        <tr><td>Heston Eveland</td><td></td><td>35.6</td><td>40</td><td>30</td><td>-</td><td>-</td><td>41</td><td>43</td><td>43</td><td>41</td><td>-</td><td>-</td><td>-</td><td>-</td><td>44</td><td>39</td><td>39</td><td>9</td><td>40.0</td></tr>
        <tr><td>Cameron Guidry</td><td>R</td><td>35.0</td><td>-</td><td>32</td><td>39</td><td>31</td><td>37</td><td>-</td><td>40</td><td>30</td><td>-</td><td>36</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>7</td><td>35.0</td></tr>
        <tr><td>Jonathan Roberson</td><td></td><td>40.0</td><td>-</td><td>42</td><td>-</td><td>-</td><td>-</td><td>-</td><td>45</td><td>43</td><td>-</td><td>-</td><td>47</td><td>41</td><td>47</td><td>-</td><td>44</td><td>7</td><td>44.1</td></tr>
        <tr><td>Tim Schleder</td><td></td><td>30.1</td><td>17</td><td>-</td><td>18</td><td>-</td><td>-</td><td>34</td><td>30</td><td>-</td><td>33</td><td>-</td><td>41</td><td>34</td><td>31</td><td>31</td><td>27</td><td>10</td><td>29.6</td></tr>
        <tr><td>Alex Wickline</td><td></td><td>30.5</td><td>37</td><td>-</td><td>43</td><td>42</td><td>47</td><td>40</td><td>-</td><td>-</td><td>43</td><td>40</td><td>36</td><td>46</td><td>41</td><td>36</td><td>36</td><td>12</td><td>40.6</td></tr>
        <tr><td>Tyler Workman</td><td>R</td><td>35.0</td><td>28</td><td>25</td><td>-</td><td>28</td><td>35</td><td>-</td><td>-</td><td>35</td><td>-</td><td>31</td><td>32</td><td>36</td><td>29</td><td>24</td><td>27</td><td>11</td><td>30.0</td></tr>
        <tr><td>David Larsen</td><td></td><td>43.0</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>44</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>1</td><td>43.5</td></tr>
        <tr><td>Guns DUMMY1</td><td></td><td>32.0</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>32.0</td></tr>
        <tr><td>Guns DUMMY2</td><td></td><td>32.0</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>32.0</td></tr>
        <tr><td>TOTAL TARGETS</td><td></td><td></td><td>160</td><td>162</td><td>182</td><td>180</td><td>201</td><td>197</td><td>197</td><td>191</td><td>207</td><td>185</td><td>201</td><td>195</td><td>192</td><td>165</td><td>173</td><td>-</td><td></td></tr>
        <tr><td>RANK POINTS</td><td></td><td></td><td>18</td><td>24</td><td>16</td><td>22</td><td>24</td><td>23</td><td>23</td><td>20</td><td>28</td><td>22</td><td>24</td><td>23</td><td>19</td><td>16</td><td>16</td><td>-</td><td></td></tr>
        <tr><td>BONUS POINTS</td><td></td><td></td><td>-</td><td>1</td><td>6</td><td>6</td><td>7</td><td>5</td><td>6</td><td>6</td><td>5</td><td>2</td><td>5</td><td>5</td><td>5</td><td>-</td><td>-</td><td>-</td><td></td></tr>
      </table>
    </div>
  `;
}
