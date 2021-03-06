gchat conversation visualizer
=============================

Some flaky scripts to log and visualize your chat history via gchat.

Required packages
--

Python packages
> pip install -r requirements.txt

Freetype

Mac OS X
> brew install freetype 

Ubuntu
> sudo apt-get install freetype

Fetch chats by running the script
--

> ./getchats.sh [your google email address]

Example:
> ./getchats.sh johndoe@gmail.com 

You will be prompted to enter your gmail password. The final data will be downloaded to the file called "analyzed".

Note if your default python 2.7 interpreter is not `python`, then edit `config.sh` to change the `PYTHON` variable to point to it.

Missing chats folder?
---------------------
If the script complains that it isn't able to find the `Gmail/[Chats]` folder, go to GMail settings, and under Labels, make sure that "Show in IMAP" is checked.

Not compatible with google hangouts
-----------------------------------
Note that google's new messaging system ("hangouts") does not log messages to IMAP (despite being accessible from the web interface). Therefore, this script is unfortunately unable to download any of your conversations post hangouts migration. It is unclear whether or not google has any desire to fix this bug. 
