-- YARG queue integration regression suite
-- Run as one SQL statement in Supabase SQL Editor or through the Supabase SQL tool.
-- Uses the CURRENT party session, which must be empty, and ROLLS BACK everything.
-- No real Rockstar accounts, email addresses, or authentication tokens are required.
-- IMPORTANT: Run only when the current party is an empty, dedicated test session.
-- Tests the actual public.yarg_get_fair_queue[_unpinned] and yarg_public_queue_points RPCs.
BEGIN;
CREATE TEMP TABLE yarg_qa_checks(test text, result text, actual text) ON COMMIT DROP;
DO $qa$
DECLARE a uuid; b uuid; c uuid; a2 uuid; b2 uuid; m1 uuid; m2 uuid; sid uuid;
 q_a int; q_b int; q_c int; pts_a bigint; pts_b bigint;
BEGIN
 SELECT current_session_id INTO sid FROM public.party_settings WHERE id=1;
 IF sid IS NULL OR (SELECT count(*) FROM public.performance_requests WHERE party_session_id=sid)<>0 THEN
  RAISE EXCEPTION 'QA requires an empty, dedicated current session';
 END IF;
 INSERT INTO public.performance_requests(song_id,song_title,song_artist,rockstar_name,song_duration_seconds,status,created_at,requester_instrument,requester_difficulty)
 VALUES('qa-a1','QA A','Artist A','QA_TEST_A',240,'waiting',now()-interval '3 min','vocals','any') RETURNING id INTO a;
 INSERT INTO public.performance_requests(song_id,song_title,song_artist,rockstar_name,song_duration_seconds,status,created_at,requester_instrument,requester_difficulty)
 VALUES('qa-b1','QA B','Artist B','QA_TEST_B',90,'waiting',now()-interval '2 min','vocals','any') RETURNING id INTO b;
 INSERT INTO public.performance_requests(song_id,song_title,song_artist,rockstar_name,song_duration_seconds,status,created_at,requester_instrument,requester_difficulty)
 VALUES('qa-c1','QA C','Artist C','QA_TEST_C',120,'waiting',now()-interval '1 min','vocals','any') RETURNING id INTO c;

 SELECT fair_position INTO q_a FROM public.yarg_get_fair_queue() WHERE request_id=a;
 SELECT fair_position INTO q_b FROM public.yarg_get_fair_queue() WHERE request_id=b;
 SELECT fair_position INTO q_c FROM public.yarg_get_fair_queue() WHERE request_id=c;
 INSERT INTO yarg_qa_checks VALUES('01 initial FIFO and pin',CASE WHEN q_a=1 AND q_b=2 AND q_c=3 THEN 'PASS' ELSE 'FAIL' END,format('A=%s B=%s C=%s',q_a,q_b,q_c));

 INSERT INTO public.performance_members(performance_request_id,rockstar_name,instrument,difficulty)
 VALUES(c,'QA_TEST_B','bass','any') RETURNING id INTO m1;
 SELECT fair_position INTO q_b FROM public.yarg_get_fair_queue_unpinned() WHERE request_id=b;
 SELECT fair_position INTO q_c FROM public.yarg_get_fair_queue_unpinned() WHERE request_id=c;
 INSERT INTO yarg_qa_checks VALUES('02 one bandmate -30 priority',CASE WHEN q_c<q_b THEN 'PASS' ELSE 'FAIL' END,format('B=%s C=%s',q_b,q_c));

 INSERT INTO public.performance_members(performance_request_id,rockstar_name,instrument,difficulty)
 VALUES(c,'QA_TEST_A','drums','any') RETURNING id INTO m2;
 SELECT points INTO pts_a FROM public.yarg_public_queue_points() WHERE rockstar_name='QA_TEST_A';
 SELECT points INTO pts_b FROM public.yarg_public_queue_points() WHERE rockstar_name='QA_TEST_B';
 INSERT INTO yarg_qa_checks VALUES('03 joining does not charge personal points',CASE WHEN pts_a=0 AND pts_b=0 THEN 'PASS' ELSE 'FAIL' END,format('A=%s B=%s',pts_a,pts_b));

 UPDATE public.performance_members SET withdrawn_at=now() WHERE id IN (m1,m2);
 SELECT fair_position INTO q_b FROM public.yarg_get_fair_queue_unpinned() WHERE request_id=b;
 SELECT fair_position INTO q_c FROM public.yarg_get_fair_queue_unpinned() WHERE request_id=c;
 INSERT INTO yarg_qa_checks VALUES('04 leaving removes bandmate bonus',CASE WHEN q_b<q_c THEN 'PASS' ELSE 'FAIL' END,format('B=%s C=%s',q_b,q_c));

 INSERT INTO public.performance_members(performance_request_id,rockstar_name,instrument,difficulty)
 VALUES(b,'QA_TEST_GUEST','bass','any');
 UPDATE public.performance_requests SET created_at=now()-interval '46 min' WHERE id=c;
 SELECT fair_position INTO q_b FROM public.yarg_get_fair_queue_unpinned() WHERE request_id=b;
 SELECT fair_position INTO q_c FROM public.yarg_get_fair_queue_unpinned() WHERE request_id=c;
 INSERT INTO yarg_qa_checks VALUES('05 waiting bonus overtakes bandmate bonus',CASE WHEN q_c<q_b THEN 'PASS' ELSE 'FAIL' END,format('B=%s C=%s',q_b,q_c));

 UPDATE public.performance_requests SET yarg_not_ready=true WHERE id=c;
 INSERT INTO yarg_qa_checks SELECT '06 pause removes song',CASE WHEN NOT EXISTS(SELECT 1 FROM public.yarg_get_fair_queue_unpinned() WHERE request_id=c) THEN 'PASS' ELSE 'FAIL' END,'paused';
 UPDATE public.performance_requests SET yarg_not_ready=false WHERE id=c;
 INSERT INTO yarg_qa_checks SELECT '07 resume restores song',CASE WHEN EXISTS(SELECT 1 FROM public.yarg_get_fair_queue_unpinned() WHERE request_id=c) THEN 'PASS' ELSE 'FAIL' END,'resumed';

 UPDATE public.performance_requests SET status='playing',started_at=now() WHERE id=a;
 SELECT points INTO pts_a FROM public.yarg_public_queue_points() WHERE rockstar_name='QA_TEST_A';
 INSERT INTO yarg_qa_checks VALUES('08 launch charges duration',CASE WHEN pts_a=240 THEN 'PASS' ELSE 'FAIL' END,'A='||coalesce(pts_a::text,'null'));
 INSERT INTO yarg_qa_checks SELECT '09 playing stays first',CASE WHEN (SELECT request_id FROM public.yarg_get_fair_queue() ORDER BY fair_position LIMIT 1)=a THEN 'PASS' ELSE 'FAIL' END,'playing A';

 INSERT INTO public.performance_requests(song_id,song_title,song_artist,rockstar_name,song_duration_seconds,status,created_at,requester_instrument,requester_difficulty)
 VALUES('qa-a2','QA A2','Artist D','QA_TEST_A',180,'waiting',now(),'vocals','any') RETURNING id INTO a2;
 SELECT fair_position INTO q_a FROM public.yarg_get_fair_queue_unpinned() WHERE request_id=a2;
 SELECT fair_position INTO q_b FROM public.yarg_get_fair_queue_unpinned() WHERE request_id=b;
 INSERT INTO yarg_qa_checks VALUES('10 played requester follows unplayed requester',CASE WHEN q_a>q_b THEN 'PASS' ELSE 'FAIL' END,format('A2=%s B=%s',q_a,q_b));

 INSERT INTO public.performance_requests(song_id,song_title,song_artist,rockstar_name,song_duration_seconds,status,created_at,requester_instrument,requester_difficulty)
 VALUES('qa-b2','QA B2','Artist E','QA_TEST_B',200,'waiting',now()+interval '1 second','vocals','any') RETURNING id INTO b2;
 SELECT fair_position INTO q_b FROM public.yarg_get_fair_queue_unpinned() WHERE request_id=b;
 SELECT fair_position INTO q_c FROM public.yarg_get_fair_queue_unpinned() WHERE request_id=b2;
 INSERT INTO yarg_qa_checks VALUES('11 own-song FIFO',CASE WHEN q_c>q_b THEN 'PASS' ELSE 'FAIL' END,format('B1=%s B2=%s',q_b,q_c));

 UPDATE public.performance_requests SET status='skipped',skipped_at=now() WHERE id=b;
 INSERT INTO yarg_qa_checks SELECT '12 skip removes song',CASE WHEN NOT EXISTS(SELECT 1 FROM public.yarg_get_fair_queue_unpinned() WHERE request_id=b) THEN 'PASS' ELSE 'FAIL' END,'skipped B';
 SELECT points INTO pts_b FROM public.yarg_public_queue_points() WHERE rockstar_name='QA_TEST_B';
 INSERT INTO yarg_qa_checks VALUES('13 skip without launch has no points',CASE WHEN pts_b=0 THEN 'PASS' ELSE 'FAIL' END,'B='||coalesce(pts_b::text,'null'));

 UPDATE public.performance_requests SET status='completed',finished_at=now() WHERE id=a;
 SELECT points INTO pts_a FROM public.yarg_public_queue_points() WHERE rockstar_name='QA_TEST_A';
 INSERT INTO yarg_qa_checks VALUES('14 completion keeps charged points',CASE WHEN pts_a=240 THEN 'PASS' ELSE 'FAIL' END,'A='||coalesce(pts_a::text,'null'));
 UPDATE public.performance_requests SET status='waiting',started_at=NULL,finished_at=NULL WHERE id=a;
 SELECT points INTO pts_a FROM public.yarg_public_queue_points() WHERE rockstar_name='QA_TEST_A';
 INSERT INTO yarg_qa_checks VALUES('15 undo completion reverses points',CASE WHEN pts_a=0 THEN 'PASS' ELSE 'FAIL' END,'A='||coalesce(pts_a::text,'null'));
END $qa$;
DO $verify$
BEGIN
 IF EXISTS(SELECT 1 FROM yarg_qa_checks WHERE result <> 'PASS') THEN
  RAISE EXCEPTION 'YARG queue regression FAILED: %', (SELECT string_agg(test||': '||actual,'; ') FROM yarg_qa_checks WHERE result<>'PASS');
 END IF;
END $verify$;
SELECT * FROM yarg_qa_checks ORDER BY test;
ROLLBACK;