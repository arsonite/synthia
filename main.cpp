#include "view/mainwindow.h"
#include "controller/maincontroller.h"

#include <QApplication>

int main(int argc, char *argv[])
{
    QApplication a(argc, argv);

    MainController *mC = new MainController();

    MainWindow mW;
    mW.setController(mC);
    mW.show();

    return a.exec();
}
