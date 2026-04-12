1. Used my RTSP livestreamer projects backend which was in Flask and migrated it into
FastAPI for faster response and better performance.

2. Removed the overlays from the previous project and modified the architecture as shown in new_architecture.png

3. We are not doing the live stream anymore but video streaming now. 

4. For first MVP, using local storage for storing videos and HLS segments and ignoring ABR for now. 

5. Using S3 for storing videos and HLS segments in future. 