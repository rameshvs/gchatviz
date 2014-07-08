import os
import sys
import cPickle
import collections
import json
import string
import datetime

import numpy as np

import message

stopword_file = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                          'stopwords.txt')

with open(stopword_file, 'r') as f:
    STOP_WORDS = f.read().split()

def padded_interval(dates,interval):
    dates = sorted(dates)
    (mini,maxi) = (dates[0],dates[-1])

    # have each one go until 5am (presumably nothing is happening then)
    mini -= datetime.timedelta(interval)
    mini = datetime.datetime(mini.year,mini.month,mini.day,5)

    maxi += datetime.timedelta(interval)
    maxi = datetime.datetime(maxi.year,maxi.month,maxi.day,5)

    return (mini,maxi)
def strip_punctuation(mystring):
    return mystring.translate(string.maketrans('',''),string.punctuation)
def make_ngram_counter(N,instring,ignore_case=True,
                       should_strip_punctuation=True):
    if ignore_case:
        instring = instring.lower()
    if should_strip_punctuation:
        instring = strip_punctuation(instring)
    words = instring.split()
    n = len(words) - (N-1)
    ng = [' '.join(words[k:k+N]) for k in xrange(n)]

    wc = WordCounter()
    for ngram in ng:
        wc[ngram] += 1
    return wc
def summarize_gmail_conversations(gmail_address, json_filename, filelist):
    (dates, counters, names) = read_gmail_dump(gmail_address, filelist)
    save_words_and_counters(dates, counters, names, json_filename)

def read_gmail_dump(gmail_address, filelist):
    """ Reads converted files from https://github.com/stephentu/gchatviz """
    msgs_by_person = collections.defaultdict(lambda: [])
    dates_by_person = collections.defaultdict(lambda: [])
    counters_by_person = collections.defaultdict(lambda: [])
    for filename in filelist:
        with open(filename) as f:
            msgs = cPickle.load(f)
            for msg in msgs:
                # TODO figure out why some messages are tz-aware & some aren't
                # until then, this is a hack
                msg._date = msg._date.replace(tzinfo=None)
                if msg._touser == gmail_address:
                    other_person = msg._fromuser
                elif msg._fromuser == gmail_address:
                    other_person = msg._touser
                else:
                    continue # probably a group chat?
                msgs_by_person[other_person].append(msg)
    names = sorted(msgs_by_person.keys())
    for name in msgs_by_person:
        msgs_by_person[name].sort(key=lambda x: x._date)
    for name in msgs_by_person:
        for m in msgs_by_person[name]:
            dates_by_person[name].append(m._date)
            ctr = make_ngram_counter(1, m._message)
            counters_by_person[name].append(ctr)
    return (dates_by_person, counters_by_person, names)

def save_words_and_counters(dates, counters, names, filename):
    (dates, binned_counter_lists) = intervalize_words(
            [dates[name] for name in names],
            [counters[name] for name in names])

    date_list = []
    for d in dates:
        dt = datetime.datetime.fromordinal(d)
        date_list.append(dt.strftime('%Y-%m-%d'))

    words = np.empty([len(names), len(dates)], dtype='object')
    counts = np.empty([len(names), len(dates)])

    for (i, binned_counter_list) in enumerate(binned_counter_lists):
        words[i, :] = binned_counter_list
        counts[i, :] = [sum(ctr.values()) for ctr in binned_counter_list]

    with open(filename, 'w') as f:
        json.dump({"names": names, "words": words.tolist(),
            "counts": counts.tolist(), "dates": date_list}, f)

def intervalize_words(date_lists, counter_lists, interval=14):
    """
    bins words in counters. takes in an interval (bin size in days), and any number
    of date-list/counter-list pairs.

    returns one list of dates (bin boundaries), and several lists of counters that
    accumulate values within bins (one list of counters for each input pair).
    """
    (minim, maxim) = padded_interval(np.hstack(date_lists), interval)
    rang = np.arange(minim.toordinal(), maxim.toordinal()+1, interval)
    all_accumulator_lists = []
    for (dates,counters) in zip(date_lists, counter_lists):
        accumulators = [WordCounter() for d in rang]
        indices = np.digitize([d.toordinal() for d in dates],rang)
        for (i,c) in zip(indices,counters):
            accumulators[i] += c
        all_accumulator_lists.append(accumulators)
    return (rang,all_accumulator_lists)


class WordCounter(collections.Counter):
    def without_below_threshold(self,threshold):
        for word in self.keys():
            if self[word] <= threshold:
                self.pop(word)

    def remove_below_threshold(self, threshold):
        new = self.copy()
        new.without_below_threshold(threshold)
        return new

    def remove_stopwords(self,stopwords=STOP_WORDS):
        for word in self.keys():
            if word in stopwords:
                self.pop(word)

    def without_stopwords(self, stopwords=STOP_WORDS):
        new = self.copy()
        new.remove_stopwords(stopwords)
        return new

    def total(self):
        return sum(self.itervalues())

    def top_N(self,N):
        top = self.most_common(N)
        return sorted(top)

    # collection.Counter's versions of these are not actually
    # in place (and are therefore too slow)
    def __iadd__(self,other):

        for word in other:
            self[word] += other[word]
        return self

    def __isub__(self,other):

        for word in other:
            self[word] -= other[word]
            assert self[word] >= 0
            if self[word] == 0:
                self.pop(word)
        return self

if __name__ == '__main__':
    if len(sys.argv) < 4:
        print("USAGE: python %s <your gmail addr> <output json file> <converted files>" % sys.argv[0])
        sys.exit(1)
    gmail_address = sys.argv[1]
    json_file = sys.argv[2]
    files = sys.argv[3:]
    summarize_gmail_conversations(gmail_address, json_file, files)
