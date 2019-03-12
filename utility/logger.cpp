#include "logger.h"

#include <iostream>

#include <QDateTime>

Logger::Logger(QString className): className_(std("\"" + className + ".cpp\"")) {}

void Logger::log(QString msg) const
{
    using namespace std;
    cerr << getTime();
    cout << std(msg) << "." << endl;
}

std::string Logger::std(QString s) const
{
    return s.toStdString();
}

std::string Logger::getTime() const
{
    return className_ + std(" (" + QDateTime::currentDateTime().toString("HH:mm:ss:ms") + "): ");
}
