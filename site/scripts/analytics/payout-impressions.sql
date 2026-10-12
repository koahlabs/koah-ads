-- Unregistered estimate input: paid Koah-native billable served impression rows.
-- Seven completed UTC days; the website applies the user-supplied $15 CPM and 70% share.
WITH
queries_in_window AS (
  SELECT id, created_at AS query_created_at
  FROM analytics.queries FINAL
  WHERE _cdc_deleted = 0
    AND created_at >= toDateTime('2026-10-04 00:00:00', 'UTC') - INTERVAL 48 HOUR
    AND created_at < toDateTime('2026-10-11 00:00:00', 'UTC')
    AND external_id != '00000000-0000-0000-0000-000000000000'
),
valid_impressions AS (
  SELECT i.id, i.created_at, i.ad_id, i.publisher_id
  FROM analytics.impressions AS i FINAL
  INNER JOIN queries_in_window AS q ON q.id = i.query_id
  WHERE i._cdc_deleted = 0
    AND i.created_at >= toDateTime('2026-10-04 00:00:00', 'UTC')
    AND i.created_at < toDateTime('2026-10-11 00:00:00', 'UTC')
    AND i.created_at >= q.query_created_at
    AND i.created_at <= q.query_created_at + INTERVAL 48 HOUR
    AND i.ad_id NOT IN (11117, 11184, 14042) -- programmatic demand uses separate payment sources
),
real_publishers AS (
  SELECT p.id
  FROM analytics.publishers AS p FINAL
  INNER JOIN analytics.teams AS t FINAL ON t.id = p.team_id
  WHERE p._cdc_deleted = 0 AND t._cdc_deleted = 0
    AND p.demo = false AND t.demo = false
),
paid_ads AS (
  SELECT a.id
  FROM analytics.ads AS a FINAL
  INNER JOIN analytics.ad_groups AS g FINAL ON g.id = a.ad_group_id
  INNER JOIN analytics.campaigns AS c FINAL ON c.id = g.campaign_id
  INNER JOIN analytics.advertisers AS av FINAL ON av.id = a.advertiser_id
  INNER JOIN analytics.teams AS t FINAL ON t.id = av.team_id
  WHERE a._cdc_deleted = 0 AND g._cdc_deleted = 0 AND c._cdc_deleted = 0
    AND av._cdc_deleted = 0 AND t._cdc_deleted = 0
    AND a.discarded_at IS NULL AND g.discarded_at IS NULL AND c.discarded_at IS NULL
    AND av.demo = false AND t.demo = false
    AND c.campaign_type = 'paid' -- exclude free house and externally paid affiliate activity
),
publisher_impressions AS (
  SELECT i.id, i.created_at, i.ad_id
  FROM valid_impressions AS i
  INNER JOIN real_publishers AS p ON p.id = i.publisher_id
),
paid_impressions AS (
  SELECT i.id, i.created_at
  FROM publisher_impressions AS i
  INNER JOIN paid_ads AS a ON a.id = i.ad_id
)
SELECT toDate(created_at, 'UTC') AS day, count() AS impressions, uniqExact(id) AS distinct_impressions
FROM paid_impressions
GROUP BY day
ORDER BY day
