#ifndef MAINCONTROLLER_H
#define MAINCONTROLLER_H

#include "utility/logger.h"

#include <QObject>
#include <QKeyEvent>

class MainController: public QObject
{
Q_OBJECT
public:
    MainController();
    ~MainController();

    void keyPressed(QKeyEvent *e);
    void KeyReleased(QKeyEvent *e);

signals:
    void key(QString key);

private:
    Logger lg;
};

#endif // MAINCONTROLLER_H
