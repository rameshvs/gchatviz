PYTHON=python
if [[ $OSTYPE == darwin* ]]; then
    OPEN=open
elif [[ $OSTYPE == ubuntu* ]]; then
    OPEN=xdg-open
else
    OPEN=/bin/echo
fi
